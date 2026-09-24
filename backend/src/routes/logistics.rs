//! Logistics job tracking (issue #37): claiming, assignment, and status
//! updates for shipments. Ported 1:1 from
//! `src/services/logisticsService.ts` -- see that file's comments for the
//! original business rules this mirrors.

use axum::{Json, extract::{Path, State}};

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::ids;
use crate::models::logistics::{AssignProviderRequest, LogisticsJob, UpdateJobStatusRequest};
use crate::models::transaction::{Transaction, TransactionWithHistory};
use crate::models::user::UserRole;
use crate::state::AppState;
use crate::state_machine::{Actor, TransactionStatus};

use super::transactions::{apply_transition, history_for, load_transaction};

/// Auto-creates the logistics job for a transaction once its payment is
/// confirmed -- called from `transactions::mock_confirm_payment`, mirroring
/// `logisticsService.createJobForTransaction`'s "called automatically after
/// payment is confirmed" behavior. Idempotent: a transaction can only ever
/// have one job (`transaction_id` is `UNIQUE`), so a re-confirm is a no-op.
pub(crate) async fn create_job_for_transaction(
    state: &AppState,
    txn: &Transaction,
) -> AppResult<()> {
    if sqlx::query_scalar!(
        "SELECT id FROM logistics_jobs WHERE transaction_id = $1",
        txn.id,
    )
    .fetch_optional(&state.db)
    .await?
    .is_some()
    {
        return Ok(());
    }

    // 3% of the transaction total, same estimate the frontend used.
    let logistics_cost = (txn.total_amount * rust_decimal::Decimal::new(3, 2)).round();
    let job_id = ids::generate("LOG-AGF");

    sqlx::query!(
        r#"
        INSERT INTO logistics_jobs
            (id, transaction_id, commodity, quantity, unit, pickup_location, delivery_location,
             pickup_date, expected_delivery_date, logistics_cost, currency, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10, 'PENDING')
        ON CONFLICT (transaction_id) DO NOTHING
        "#,
        job_id,
        txn.id,
        txn.commodity,
        txn.quantity,
        txn.unit,
        txn.pickup_location,
        txn.delivery_location,
        txn.expected_delivery_date,
        logistics_cost,
        txn.currency,
    )
    .execute(&state.db)
    .await?;

    sqlx::query!(
        "UPDATE transactions SET logistics_job_id = $2 WHERE id = $1 AND logistics_job_id IS NULL",
        txn.id,
        job_id,
    )
    .execute(&state.db)
    .await?;

    Ok(())
}

async fn load_job(state: &AppState, id: &str) -> AppResult<LogisticsJob> {
    sqlx::query_as!(
        LogisticsJob,
        r#"
        SELECT id, transaction_id, provider_id, provider_name, commodity, quantity, unit,
               pickup_location, delivery_location, pickup_date, expected_delivery_date,
               logistics_cost, currency, status, proof_of_delivery, created_at, updated_at
        FROM logistics_jobs WHERE id = $1
        "#,
        id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Logistics job not found.".into()))
}

/// `GET /logistics/jobs` -- logistics providers see unclaimed jobs plus
/// their own; admins see everything. No buyer/supplier use case for this
/// listing (they already see their own transaction's job via the
/// transaction itself), so it's restricted to those two roles.
pub async fn list_jobs(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<LogisticsJob>>> {
    let jobs = match auth.role {
        UserRole::Admin => {
            sqlx::query_as!(
                LogisticsJob,
                r#"
                SELECT id, transaction_id, provider_id, provider_name, commodity, quantity, unit,
                       pickup_location, delivery_location, pickup_date, expected_delivery_date,
                       logistics_cost, currency, status, proof_of_delivery, created_at, updated_at
                FROM logistics_jobs ORDER BY created_at DESC
                "#,
            )
            .fetch_all(&state.db)
            .await?
        }
        UserRole::Logistics => {
            sqlx::query_as!(
                LogisticsJob,
                r#"
                SELECT id, transaction_id, provider_id, provider_name, commodity, quantity, unit,
                       pickup_location, delivery_location, pickup_date, expected_delivery_date,
                       logistics_cost, currency, status, proof_of_delivery, created_at, updated_at
                FROM logistics_jobs
                WHERE status = 'PENDING' OR provider_id = $1
                ORDER BY created_at DESC
                "#,
                auth.user_id,
            )
            .fetch_all(&state.db)
            .await?
        }
        _ => return Err(AppError::Forbidden("Only logistics providers or admins can list jobs.".into())),
    };

    Ok(Json(jobs))
}

/// `POST /logistics/jobs/:id/claim` -- a logistics provider claims an
/// unassigned job for themselves. Mirrors `logisticsService.claimJob`.
pub async fn claim_job(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<LogisticsJob>> {
    auth.require_role(UserRole::Logistics)?;

    let job = load_job(&state, &id).await?;
    if job.provider_id.is_some() {
        return Err(AppError::Conflict("This job has already been claimed.".into()));
    }

    let updated = assign(&state, &job, &auth.user_id, &auth.name).await?;

    let mut db_tx = state.db.begin().await?;
    apply_transition(
        &mut db_tx,
        &job.transaction_id,
        TransactionStatus::LogisticsAssigned,
        Actor::Logistics,
        &auth.name,
        "logistics",
        &format!("{} claimed the logistics assignment.", auth.name),
    )
    .await?;
    db_tx.commit().await?;

    Ok(Json(updated))
}

/// `POST /logistics/jobs/:id/assign` -- an admin assigns a specific
/// provider. Mirrors `logisticsService.assignProvider`.
pub async fn assign_job(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<AssignProviderRequest>,
) -> AppResult<Json<LogisticsJob>> {
    auth.require_role(UserRole::Admin)?;

    let job = load_job(&state, &id).await?;

    let provider = sqlx::query!(
        r#"SELECT name, role as "role: UserRole" FROM users WHERE id = $1"#,
        body.provider_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::BadRequest("Provider not found.".into()))?;
    if provider.role != UserRole::Logistics {
        return Err(AppError::BadRequest("Provider must have the logistics role.".into()));
    }

    let updated = assign(&state, &job, &body.provider_id, &provider.name).await?;

    let mut db_tx = state.db.begin().await?;
    apply_transition(
        &mut db_tx,
        &job.transaction_id,
        TransactionStatus::LogisticsAssigned,
        Actor::Admin,
        &auth.name,
        "admin",
        &format!("{} assigned as logistics provider.", provider.name),
    )
    .await?;
    db_tx.commit().await?;

    Ok(Json(updated))
}

async fn assign(
    state: &AppState,
    job: &LogisticsJob,
    provider_id: &str,
    provider_name: &str,
) -> AppResult<LogisticsJob> {
    sqlx::query_as!(
        LogisticsJob,
        r#"
        UPDATE logistics_jobs SET provider_id = $2, provider_name = $3, status = 'ASSIGNED', updated_at = now()
        WHERE id = $1
        RETURNING id, transaction_id, provider_id, provider_name, commodity, quantity, unit,
                  pickup_location, delivery_location, pickup_date, expected_delivery_date,
                  logistics_cost, currency, status, proof_of_delivery, created_at, updated_at
        "#,
        job.id,
        provider_id,
        provider_name,
    )
    .fetch_one(&state.db)
    .await
    .map_err(Into::into)
}

/// A job's own status is freer-form than the transaction's -- it's just a
/// whitelist check here, with the *transaction* state machine (via
/// `apply_transition`) enforcing real ordering (you can't jump straight
/// from PICKED_UP to DELIVERED-without-IN_TRANSIT, etc). `PENDING`,
/// `ASSIGNED`, and `FAILED` have no transaction-status equivalent -- same
/// gap as `logisticsService.updateJobStatus`'s `txnStatusMap`, which never
/// mapped `FAILED` either. Ported as-is rather than fixed here.
fn job_status_to_transaction_status(status: &str) -> Option<TransactionStatus> {
    match status {
        "ACCEPTED" => Some(TransactionStatus::LogisticsAccepted),
        "REJECTED" => Some(TransactionStatus::LogisticsRejected),
        "READY_FOR_PICKUP" => Some(TransactionStatus::ReadyForPickup),
        "PICKED_UP" => Some(TransactionStatus::PickedUp),
        "IN_TRANSIT" => Some(TransactionStatus::InTransit),
        "DELIVERED" => Some(TransactionStatus::Delivered),
        "COMPLETED" => Some(TransactionStatus::Completed),
        _ => None,
    }
}

const VALID_JOB_STATUSES: &[&str] = &[
    "PENDING", "ASSIGNED", "ACCEPTED", "REJECTED", "READY_FOR_PICKUP",
    "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED", "FAILED",
];

/// `PATCH /logistics/jobs/:id/status` -- only the provider a job is
/// assigned to may update it. Mirrors `logisticsService.updateJobStatus`.
pub async fn update_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateJobStatusRequest>,
) -> AppResult<Json<TransactionWithHistory>> {
    auth.require_role(UserRole::Logistics)?;

    let job = load_job(&state, &id).await?;
    if job.provider_id.as_deref() != Some(auth.user_id.as_str()) {
        return Err(AppError::Forbidden("This job is not assigned to you.".into()));
    }
    if !VALID_JOB_STATUSES.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(format!("Unknown logistics status: {}", body.status)));
    }

    let proof_json = body
        .proof_of_delivery
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    sqlx::query!(
        r#"
        UPDATE logistics_jobs SET
            status = $2,
            proof_of_delivery = COALESCE($3, proof_of_delivery),
            updated_at = now()
        WHERE id = $1
        "#,
        job.id,
        body.status,
        proof_json,
    )
    .execute(&state.db)
    .await?;

    let transaction = if let Some(to) = job_status_to_transaction_status(&body.status) {
        let mut db_tx = state.db.begin().await?;
        let t = apply_transition(
            &mut db_tx,
            &job.transaction_id,
            to,
            Actor::Logistics,
            &auth.name,
            "logistics",
            &format!("Shipment status updated to {}.", body.status),
        )
        .await?;
        db_tx.commit().await?;
        t
    } else {
        load_transaction(&state, &job.transaction_id).await?
    };

    let history = history_for(&state, &job.transaction_id).await?;
    Ok(Json(TransactionWithHistory { transaction, history }))
}
