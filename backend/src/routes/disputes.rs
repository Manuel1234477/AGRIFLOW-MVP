//! Transaction dispute lifecycle (issue #36). Ported 1:1 from
//! `src/services/disputeService.ts`.
//!
//! **Deviation from the issue's literal spec, worth flagging**: it says
//! `POST /disputes` is open to "Buyer or Supplier on the transaction". The
//! actual authoritative state machine (`state_machine.rs`, itself a 1:1
//! port of `transactionStateMachine.ts`) gates the `DISPUTED` status to
//! `Actor::Buyer` only (`ALLOWED_ACTORS.DISPUTED = ['buyer']` in the TS
//! source) -- a supplier has never been able to raise one in this app.
//! Built to the state machine, since loosening it here to match the issue
//! would be silently changing already-established, tested behavior on the
//! strength of one issue's prose rather than a deliberate decision.

use axum::{Json, extract::{Path, State}};

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::ids;
use crate::models::dispute::{Dispute, RaiseDisputeRequest, ResolveDisputeRequest};
use crate::models::transaction::TransactionWithHistory;
use crate::models::user::UserRole;
use crate::state::AppState;
use crate::state_machine::{Actor, TransactionStatus};
use crate::validation::require_non_empty;

use super::transactions::{apply_transition, history_for, load_transaction};

pub async fn raise(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<RaiseDisputeRequest>,
) -> AppResult<Json<TransactionWithHistory>> {
    let txn = load_transaction(&state, &body.transaction_id).await?;
    if auth.role != UserRole::Buyer || auth.user_id != txn.buyer_id {
        return Err(AppError::Forbidden(
            "Only the buyer on this transaction can raise a dispute.".into(),
        ));
    }

    require_non_empty("reason", &body.reason)?;
    require_non_empty("description", &body.description)?;

    let dispute_id = ids::generate("DIS-AGF");

    let mut db_tx = state.db.begin().await?;

    sqlx::query!(
        r#"
        INSERT INTO disputes (id, transaction_id, raised_by_id, raised_by_name, reason, description, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
        "#,
        dispute_id,
        txn.id,
        auth.user_id,
        auth.name,
        body.reason,
        body.description,
    )
    .execute(&mut *db_tx)
    .await?;

    sqlx::query!(
        "UPDATE transactions SET dispute_id = $2 WHERE id = $1",
        txn.id,
        dispute_id,
    )
    .execute(&mut *db_tx)
    .await?;

    let transaction = apply_transition(
        &mut db_tx,
        &txn.id,
        TransactionStatus::Disputed,
        Actor::Buyer,
        &auth.name,
        "buyer",
        &format!("Dispute raised: {}", body.reason),
    )
    .await?;

    db_tx.commit().await?;

    let history = history_for(&state, &txn.id).await?;
    Ok(Json(TransactionWithHistory { transaction, history }))
}

/// `GET /disputes` -- admin sees all; buyer/supplier see disputes on
/// transactions they're a party to (not just ones they personally raised,
/// since only buyers can raise one -- a supplier still needs visibility
/// into disputes filed against their own transactions).
pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<Dispute>>> {
    let disputes = if auth.role == UserRole::Admin {
        sqlx::query_as!(
            Dispute,
            r#"
            SELECT id, transaction_id, raised_by_id, raised_by_name, reason, description,
                   status, resolution, resolved_by_id, resolved_by_name, resolved_at,
                   created_at, updated_at
            FROM disputes ORDER BY created_at DESC
            "#,
        )
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as!(
            Dispute,
            r#"
            SELECT d.id, d.transaction_id, d.raised_by_id, d.raised_by_name, d.reason, d.description,
                   d.status, d.resolution, d.resolved_by_id, d.resolved_by_name, d.resolved_at,
                   d.created_at, d.updated_at
            FROM disputes d
            JOIN transactions t ON t.id = d.transaction_id
            WHERE t.buyer_id = $1 OR t.supplier_id = $1
            ORDER BY d.created_at DESC
            "#,
            auth.user_id,
        )
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(disputes))
}

/// `POST /disputes/:id/resolve` -- admin only. `outcome` decides whether
/// the transaction ends at COMPLETED (dispute found in the supplier's
/// favor) or CANCELLED (found in the buyer's favor / trade unwound),
/// mirroring `disputeService.resolve`'s `outcome: 'completed' | 'cancelled'`.
pub async fn resolve(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<ResolveDisputeRequest>,
) -> AppResult<Json<TransactionWithHistory>> {
    auth.require_role(UserRole::Admin)?;
    require_non_empty("decision", &body.decision)?;

    let to = match body.outcome.as_str() {
        "completed" => TransactionStatus::Completed,
        "cancelled" => TransactionStatus::Cancelled,
        other => return Err(AppError::BadRequest(format!("Unknown outcome: {other}"))),
    };

    let dispute = sqlx::query_as!(
        Dispute,
        r#"
        SELECT id, transaction_id, raised_by_id, raised_by_name, reason, description,
               status, resolution, resolved_by_id, resolved_by_name, resolved_at,
               created_at, updated_at
        FROM disputes WHERE id = $1
        "#,
        id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Dispute not found.".into()))?;

    let mut db_tx = state.db.begin().await?;

    sqlx::query!(
        r#"
        UPDATE disputes SET
            status = 'RESOLVED',
            resolution = $2,
            resolved_by_id = $3,
            resolved_by_name = $4,
            resolved_at = now(),
            updated_at = now()
        WHERE id = $1
        "#,
        dispute.id,
        body.decision,
        auth.user_id,
        auth.name,
    )
    .execute(&mut *db_tx)
    .await?;

    let transaction = apply_transition(
        &mut db_tx,
        &dispute.transaction_id,
        to,
        Actor::Admin,
        &auth.name,
        "admin",
        &format!("Dispute resolved: {}", body.decision),
    )
    .await?;

    db_tx.commit().await?;

    let history = history_for(&state, &dispute.transaction_id).await?;
    Ok(Json(TransactionWithHistory { transaction, history }))
}
