use axum::{
    Json,
    extract::{Path, State},
};
use std::str::FromStr;

use crate::auth::AuthUser;
use crate::bachs;
use crate::error::{AppError, AppResult};
use crate::ids;
use crate::models::listing::SupplyListing;
use crate::models::payment::{
    BachsCheckoutRequest, BachsCheckoutResponse, ConfirmPaymentRequest, InitiatePaymentRequest,
    Payment,
};
use crate::models::transaction::{
    CreateTransactionRequest, MockPaymentFailRequest, Transaction, TransactionEvent,
    TransactionWithHistory, TransitionRequest,
};
use crate::models::user::UserRole;
use crate::state::AppState;
use crate::state_machine::{Actor, TransactionStatus, can_actor_transition};

fn role_to_actor(role: UserRole) -> Actor {
    match role {
        UserRole::Buyer => Actor::Buyer,
        UserRole::Supplier => Actor::Supplier,
        UserRole::Logistics => Actor::Logistics,
        UserRole::Admin => Actor::Admin,
    }
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateTransactionRequest>,
) -> AppResult<Json<TransactionWithHistory>> {
    auth.require_role(UserRole::Buyer)?;

    if body.quantity <= rust_decimal::Decimal::ZERO {
        return Err(AppError::BadRequest("Quantity must be greater than zero.".into()));
    }

    let listing = sqlx::query_as!(
        SupplyListing,
        r#"
        SELECT id, supplier_id, supplier_name, supplier_verified, commodity, quantity,
               unit, quality_grade, price_per_unit, currency, location, availability_date,
               description, status as "status: _", created_at, updated_at
        FROM supply_listings WHERE id = $1
        "#,
        body.listing_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Listing not found.".into()))?;

    if listing.supplier_id == auth.user_id {
        return Err(AppError::BadRequest("You cannot buy from your own listing.".into()));
    }
    if body.quantity > listing.quantity {
        return Err(AppError::BadRequest(format!(
            "Only {} {} available in this listing.",
            listing.quantity, listing.unit
        )));
    }

    let total_amount = body.quantity * listing.price_per_unit;

    let mut result = None;
    for _ in 0..ids::MAX_ID_ATTEMPTS {
        let id = ids::generate("TXN-AGF");
        let mut tx = state.db.begin().await?;

        let insert = sqlx::query_as!(
            Transaction,
            r#"
            INSERT INTO transactions
                (id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                 commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                 pickup_location, delivery_location, expected_delivery_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'PENDING')
            RETURNING id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                      commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                      pickup_location, delivery_location, expected_delivery_date, status, payment_id,
                      logistics_job_id, dispute_id, created_at, updated_at
            "#,
            id,
            listing.id,
            body.demand_id,
            auth.user_id,
            auth.name,
            listing.supplier_id,
            listing.supplier_name,
            listing.commodity,
            body.quantity,
            listing.unit,
            listing.quality_grade,
            listing.price_per_unit,
            total_amount,
            listing.currency,
            listing.location,
            body.delivery_location,
            body.expected_delivery_date,
        )
        .fetch_one(&mut *tx)
        .await;

        // A collision drops `tx` here (implicit rollback) and retries with a
        // fresh id and a fresh transaction -- Postgres won't run further
        // statements on a transaction that already had a failed statement.
        let txn = match insert {
            Ok(t) => t,
            Err(e) if ids::is_id_collision(&e) => continue,
            Err(e) => return Err(e.into()),
        };

        let event = sqlx::query_as!(
            TransactionEvent,
            r#"
            INSERT INTO transaction_events (transaction_id, status, actor, actor_role, note)
            VALUES ($1, 'PENDING', $2, 'buyer', 'Transaction initiated by buyer.')
            RETURNING id, transaction_id, status, actor, actor_role, note, created_at
            "#,
            txn.id,
            auth.name,
        )
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        result = Some((txn, event));
        break;
    }
    let (txn, event) = result.ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!(
            "failed to generate a unique transaction id after {} attempts",
            ids::MAX_ID_ATTEMPTS
        ))
    })?;

    Ok(Json(TransactionWithHistory {
        transaction: txn,
        history: vec![event],
    }))
}

pub async fn list_mine(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<Transaction>>> {
    let txns = match auth.role {
        UserRole::Buyer => {
            sqlx::query_as!(
                Transaction,
                r#"SELECT id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                          commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                          pickup_location, delivery_location, expected_delivery_date, status, payment_id,
                          logistics_job_id, dispute_id, created_at, updated_at
                   FROM transactions WHERE buyer_id = $1 ORDER BY created_at DESC"#,
                auth.user_id,
            )
            .fetch_all(&state.db)
            .await?
        }
        UserRole::Supplier => {
            sqlx::query_as!(
                Transaction,
                r#"SELECT id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                          commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                          pickup_location, delivery_location, expected_delivery_date, status, payment_id,
                          logistics_job_id, dispute_id, created_at, updated_at
                   FROM transactions WHERE supplier_id = $1 ORDER BY created_at DESC"#,
                auth.user_id,
            )
            .fetch_all(&state.db)
            .await?
        }
        UserRole::Admin => {
            sqlx::query_as!(
                Transaction,
                r#"SELECT id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                          commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                          pickup_location, delivery_location, expected_delivery_date, status, payment_id,
                          logistics_job_id, dispute_id, created_at, updated_at
                   FROM transactions ORDER BY created_at DESC"#,
            )
            .fetch_all(&state.db)
            .await?
        }
        UserRole::Logistics => Vec::new(),
    };

    Ok(Json(txns))
}

pub(crate) async fn load_transaction(state: &AppState, id: &str) -> AppResult<Transaction> {
    sqlx::query_as!(
        Transaction,
        r#"SELECT id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                  commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                  pickup_location, delivery_location, expected_delivery_date, status, payment_id,
                  logistics_job_id, dispute_id, created_at, updated_at
           FROM transactions WHERE id = $1"#,
        id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Transaction not found.".into()))
}

fn assert_participant_or_admin(auth: &AuthUser, txn: &Transaction) -> AppResult<()> {
    let is_participant = auth.user_id == txn.buyer_id || auth.user_id == txn.supplier_id;
    if auth.role == UserRole::Admin || is_participant {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "You are not a participant in this transaction.".into(),
        ))
    }
}

pub async fn get_one(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<TransactionWithHistory>> {
    let txn = load_transaction(&state, &id).await?;
    assert_participant_or_admin(&auth, &txn)?;

    let history = sqlx::query_as!(
        TransactionEvent,
        r#"SELECT id, transaction_id, status, actor, actor_role, note, created_at
           FROM transaction_events WHERE transaction_id = $1 ORDER BY created_at ASC"#,
        id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(TransactionWithHistory {
        transaction: txn,
        history,
    }))
}

pub async fn transition(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<TransitionRequest>,
) -> AppResult<Json<TransactionWithHistory>> {
    let txn = load_transaction(&state, &id).await?;

    // Buyers and suppliers may only drive transactions they're actually part
    // of; admin/system/logistics are broader roles until jobs/assignment
    // tables exist, so they're checked purely via the state machine's actor
    // table for now.
    if matches!(auth.role, UserRole::Buyer | UserRole::Supplier) {
        assert_participant_or_admin(&auth, &txn)?;
    }

    let from = TransactionStatus::from_str(&txn.status)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    let to = TransactionStatus::from_str(&body.to).map_err(AppError::BadRequest)?;
    let actor = role_to_actor(auth.role);

    let check = can_actor_transition(from, to, actor);
    if !check.allowed {
        return Err(AppError::Conflict(
            check.reason.unwrap_or_else(|| "Transition not permitted.".into()),
        ));
    }

    let mut db_tx = state.db.begin().await?;

    let updated = sqlx::query_as!(
        Transaction,
        r#"
        UPDATE transactions SET status = $2, updated_at = now() WHERE id = $1
        RETURNING id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                  commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                  pickup_location, delivery_location, expected_delivery_date, status, payment_id,
                  logistics_job_id, dispute_id, created_at, updated_at
        "#,
        id,
        to.as_str(),
    )
    .fetch_one(&mut *db_tx)
    .await?;

    sqlx::query!(
        r#"INSERT INTO transaction_events (transaction_id, status, actor, actor_role, note)
           VALUES ($1, $2, $3, $4, $5)"#,
        id,
        to.as_str(),
        auth.name,
        actor.to_string(),
        body.note,
    )
    .execute(&mut *db_tx)
    .await?;

    db_tx.commit().await?;

    let history = sqlx::query_as!(
        TransactionEvent,
        r#"SELECT id, transaction_id, status, actor, actor_role, note, created_at
           FROM transaction_events WHERE transaction_id = $1 ORDER BY created_at ASC"#,
        id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(TransactionWithHistory {
        transaction: updated,
        history,
    }))
}

fn assert_is_buyer_on_txn(auth: &AuthUser, txn: &Transaction) -> AppResult<()> {
    if auth.role != UserRole::Buyer || auth.user_id != txn.buyer_id {
        return Err(AppError::Forbidden(
            "Only the buyer on this transaction can settle its payment.".into(),
        ));
    }
    Ok(())
}

/// Applies one system-actor transition inside an already-open db transaction,
/// checking it against the state machine the same way the generic
/// `transition` handler does, and records the event. `actor`/`actor_name`/
/// `actor_role` drive both the state-machine check and the recorded event
/// -- shared by `apply_system_transition` (payment mock endpoints, which
/// are the only place a request is allowed to act as `Actor::System`) and
/// `logistics.rs` (real Logistics/Admin actors driving shipment status).
pub(crate) async fn apply_transition(
    db_tx: &mut sqlx::PgConnection,
    id: &str,
    to: TransactionStatus,
    actor: Actor,
    actor_name: &str,
    actor_role: &str,
    note: &str,
) -> AppResult<Transaction> {
    let current = sqlx::query_as!(
        Transaction,
        r#"SELECT id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                  commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                  pickup_location, delivery_location, expected_delivery_date, status, payment_id,
                  logistics_job_id, dispute_id, created_at, updated_at
           FROM transactions WHERE id = $1 FOR UPDATE"#,
        id,
    )
    .fetch_one(&mut *db_tx)
    .await?;

    let from = TransactionStatus::from_str(&current.status)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    let check = can_actor_transition(from, to, actor);
    if !check.allowed {
        return Err(AppError::Conflict(
            check.reason.unwrap_or_else(|| "Transition not permitted.".into()),
        ));
    }

    let updated = sqlx::query_as!(
        Transaction,
        r#"
        UPDATE transactions SET status = $2, updated_at = now() WHERE id = $1
        RETURNING id, listing_id, demand_id, buyer_id, buyer_name, supplier_id, supplier_name,
                  commodity, quantity, unit, quality_grade, price_per_unit, total_amount, currency,
                  pickup_location, delivery_location, expected_delivery_date, status, payment_id,
                  logistics_job_id, dispute_id, created_at, updated_at
        "#,
        id,
        to.as_str(),
    )
    .fetch_one(&mut *db_tx)
    .await?;

    sqlx::query!(
        r#"INSERT INTO transaction_events (transaction_id, status, actor, actor_role, note)
           VALUES ($1, $2, $3, $4, $5)"#,
        id,
        to.as_str(),
        actor_name,
        actor_role,
        note,
    )
    .execute(&mut *db_tx)
    .await?;

    Ok(updated)
}

async fn apply_system_transition(
    db_tx: &mut sqlx::PgConnection,
    id: &str,
    to: TransactionStatus,
    note: &str,
) -> AppResult<Transaction> {
    apply_transition(db_tx, id, to, Actor::System, "AgriFlow System", "system", note).await
}

pub(crate) async fn history_for(state: &AppState, id: &str) -> AppResult<Vec<TransactionEvent>> {
    Ok(sqlx::query_as!(
        TransactionEvent,
        r#"SELECT id, transaction_id, status, actor, actor_role, note, created_at
           FROM transaction_events WHERE transaction_id = $1 ORDER BY created_at ASC"#,
        id,
    )
    .fetch_all(&state.db)
    .await?)
}

pub(crate) async fn payment_for_txn(state: &AppState, transaction_id: &str) -> AppResult<Option<Payment>> {
    Ok(sqlx::query_as!(
        Payment,
        r#"SELECT id, transaction_id, payer_id, amount, currency, provider, provider_reference,
                  stellar_tx_hash, status, failure_reason, created_at, updated_at, completed_at
           FROM payments WHERE transaction_id = $1"#,
        transaction_id,
    )
    .fetch_optional(&state.db)
    .await?)
}

/// Creates the pending payment record for a transaction the buyer is about
/// to pay -- the durable counterpart to the ACCEPTED -> PAYMENT_PENDING
/// transition the generic /transition endpoint already allows a buyer to
/// drive. Idempotent: calling it again for the same transaction returns the
/// existing record rather than creating a second one.
///
/// Also performs that ACCEPTED -> PAYMENT_PENDING move itself when the
/// transaction is still ACCEPTED. The frontend fires /transition first, but
/// only when its cached copy says ACCEPTED and it swallows any error, so a
/// stale cache used to leave the transaction ACCEPTED and every settlement
/// path (Bachs checkout, mock confirm) would then 409.
pub async fn initiate_payment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<InitiatePaymentRequest>,
) -> AppResult<Json<Payment>> {
    let txn = load_transaction(&state, &id).await?;
    assert_is_buyer_on_txn(&auth, &txn)?;

    if txn.status == TransactionStatus::Accepted.as_str() {
        let mut db_tx = state.db.begin().await?;
        apply_transition(
            &mut db_tx,
            &id,
            TransactionStatus::PaymentPending,
            Actor::Buyer,
            &auth.name,
            "buyer",
            "Buyer initiated payment.",
        )
        .await?;
        db_tx.commit().await?;
    }

    if let Some(existing) = payment_for_txn(&state, &id).await? {
        return Ok(Json(existing));
    }

    if body.amount <= rust_decimal::Decimal::ZERO {
        return Err(AppError::BadRequest("Amount must be greater than zero.".into()));
    }

    // NOTE: single-attempt id generation, matching every other insert on
    // this branch of main today. The collision-retry helper (ids::generate
    // with a retry loop) lives in a separate, not-yet-merged PR
    // (fix/id-collision-retry) -- once that lands, this insert should be
    // updated to use it the same way listings/demands/users/transactions
    // do, rather than duplicating that mechanism here first.
    let payment_id = ids::generate("PAY-AGF");
    let payment = sqlx::query_as!(
        Payment,
        r#"
        INSERT INTO payments (id, transaction_id, payer_id, amount, currency, status)
        VALUES ($1, $2, $3, $4, $5, 'PENDING')
        RETURNING id, transaction_id, payer_id, amount, currency, provider, provider_reference,
                  stellar_tx_hash, status, failure_reason, created_at, updated_at, completed_at
        "#,
        payment_id,
        id,
        auth.user_id,
        body.amount,
        body.currency,
    )
    .fetch_one(&state.db)
    .await?;

    sqlx::query!("UPDATE transactions SET payment_id = $1 WHERE id = $2", payment.id, id)
        .execute(&state.db)
        .await?;

    Ok(Json(payment))
}

/// Settles the mock escrow payment for a transaction the buyer initiated,
/// then immediately queues it for logistics.
///
/// There is no real payment provider integrated yet (see backend/README.md
/// "Not built yet" — escrow/payments is the next slice) and no service/
/// webhook credential mechanism exists either, so the state machine's
/// `PAYMENT_CONFIRMED`/`LOGISTICS_PENDING` transitions — which require
/// `Actor::System` — could not be reached by any real caller: JWT roles map
/// only to Buyer/Supplier/Logistics/Admin, never System. This endpoint is
/// the one legitimate place that gap is bridged: it's gated to exactly the
/// buyer who owns the transaction, only from `PAYMENT_PENDING`, and it
/// performs the *same* system-actor transitions a real payment webhook
/// would trigger once one exists — it does not loosen the state machine's
/// actor table itself, and POST /transactions/:id/transition still rejects
/// these on any role, System included, since nothing can present System's
/// credentials there.
///
/// The amount/currency being settled are never taken from the request body
/// here -- only from the payment row `initiate_payment` already created.
/// Letting the caller redeclare the amount at confirm time would let a
/// buyer "confirm" a payment for less than they actually owed.
pub async fn mock_confirm_payment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<ConfirmPaymentRequest>,
) -> AppResult<Json<TransactionWithHistory>> {
    let txn = load_transaction(&state, &id).await?;
    assert_is_buyer_on_txn(&auth, &txn)?;

    let payment = payment_for_txn(&state, &id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Call payment/initiate before confirming.".into()))?;
    reject_if_bachs(&payment)?;

    if payment.status != "CONFIRMED" {
        let provider_reference = payment.provider_reference.unwrap_or_else(ids::provider_reference);
        sqlx::query!(
            r#"UPDATE payments SET
                 status = 'CONFIRMED',
                 provider = COALESCE($2, provider),
                 provider_reference = $3,
                 stellar_tx_hash = COALESCE($4, stellar_tx_hash),
                 completed_at = COALESCE(completed_at, now()),
                 updated_at = now()
               WHERE id = $1"#,
            payment.id,
            body.provider,
            provider_reference,
            body.stellar_tx_hash,
        )
        .execute(&state.db)
        .await?;
    }

    // Idempotent: a retry (network hiccup, double-click) after the
    // transaction already reached LOGISTICS_PENDING must not fail -- the
    // transitions below aren't valid to run twice (Postgres would reject
    // LOGISTICS_PENDING -> PAYMENT_CONFIRMED as an illegal move), so just
    // return the already-settled state.
    if txn.status == "LOGISTICS_PENDING" {
        let history = history_for(&state, &id).await?;
        return Ok(Json(TransactionWithHistory { transaction: txn, history }));
    }

    let mut db_tx = state.db.begin().await?;
    apply_system_transition(
        &mut db_tx,
        &id,
        TransactionStatus::PaymentConfirmed,
        "Payment confirmed (mock escrow).",
    )
    .await?;
    let transaction = apply_system_transition(
        &mut db_tx,
        &id,
        TransactionStatus::LogisticsPending,
        "Logistics job queued.",
    )
    .await?;
    db_tx.commit().await?;

    crate::routes::logistics::create_job_for_transaction(&state, &transaction).await?;
    // create_job_for_transaction sets transactions.logistics_job_id in a
    // separate statement after the transition above already snapshotted
    // `transaction` -- reload so this response doesn't show a stale null.
    let transaction = load_transaction(&state, &id).await?;

    let history = history_for(&state, &id).await?;
    Ok(Json(TransactionWithHistory { transaction, history }))
}

/// Marks the mock escrow payment as failed. See `mock_confirm_payment` for
/// why this needs to exist as its own endpoint rather than going through
/// the generic transition route.
pub async fn mock_fail_payment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<MockPaymentFailRequest>,
) -> AppResult<Json<TransactionWithHistory>> {
    let txn = load_transaction(&state, &id).await?;
    assert_is_buyer_on_txn(&auth, &txn)?;

    let payment = payment_for_txn(&state, &id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Call payment/initiate before reporting failure.".into()))?;
    reject_if_bachs(&payment)?;

    let reason = body.reason.unwrap_or_else(|| "Payment failed.".to_string());

    sqlx::query!(
        "UPDATE payments SET status = 'FAILED', failure_reason = $2, updated_at = now() WHERE id = $1",
        payment.id,
        reason,
    )
    .execute(&state.db)
    .await?;

    let mut db_tx = state.db.begin().await?;
    let transaction = apply_system_transition(
        &mut db_tx,
        &id,
        TransactionStatus::PaymentFailed,
        &format!("Payment failed: {reason}"),
    )
    .await?;
    db_tx.commit().await?;

    let history = history_for(&state, &id).await?;
    Ok(Json(TransactionWithHistory { transaction, history }))
}

/// A Bachs payment is settled only by its signature-verified webhook
/// (`routes::webhooks::bachs`). Letting the buyer confirm it here would let
/// them mark a checkout "paid" by simply landing on the success redirect.
fn reject_if_bachs(payment: &Payment) -> AppResult<()> {
    if payment.provider == bachs::PROVIDER {
        return Err(AppError::Conflict(
            "This payment is being settled through Bachs checkout and can only be confirmed by Bachs.".into(),
        ));
    }
    Ok(())
}

/// Only redirect targets on the frontend's own origin are accepted, so the
/// checkout can't be turned into an open redirect. With `FRONTEND_BASE_URL`
/// unset (local dev) any URL the client sends is passed through.
fn redirect_url(state: &AppState, requested: Option<String>, default_path: String) -> Option<String> {
    let Some(base) = state.config.frontend_base_url.as_deref() else {
        return requested;
    };
    match requested {
        Some(url) if url == base || url.starts_with(&format!("{base}/")) => Some(url),
        _ => Some(format!("{base}{default_path}")),
    }
}

/// Creates a Bachs hosted checkout for the payment `initiate_payment`
/// created and returns its URL for the browser to redirect to. The amount
/// and currency come from that payment row, never from this request.
///
/// Marks the payment as Bachs-sourced, which hands settlement to the
/// webhook: from here on only `POST /webhooks/bachs` can confirm or fail it.
/// Calling this again (the buyer abandoned a checkout, or a previous attempt
/// failed) opens a fresh checkout for the same payment; webhooks find the
/// payment through the `payment_id` metadata, so events for an earlier
/// checkout still settle the right row.
pub async fn create_bachs_checkout_session(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<BachsCheckoutRequest>,
) -> AppResult<Json<BachsCheckoutResponse>> {
    let txn = load_transaction(&state, &id).await?;
    assert_is_buyer_on_txn(&auth, &txn)?;

    let secret_key = state.config.bachs_secret_key.as_deref().ok_or_else(|| {
        AppError::ServiceUnavailable("Bachs checkout is not configured on this server.".into())
    })?;

    let payment = payment_for_txn(&state, &id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Call payment/initiate before starting checkout.".into()))?;

    match payment.status.as_str() {
        "PENDING" | "PROCESSING" | "FAILED" => {}
        "CONFIRMED" => return Err(AppError::Conflict("This payment has already been confirmed.".into())),
        other => return Err(AppError::Conflict(format!("Cannot start checkout for a {other} payment."))),
    }
    let txn_status = TransactionStatus::from_str(&txn.status)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    if !matches!(txn_status, TransactionStatus::PaymentPending | TransactionStatus::PaymentFailed) {
        return Err(AppError::Conflict(format!(
            "Checkout can only start while the transaction is awaiting payment (it is {}).",
            txn.status
        )));
    }

    let success_url = redirect_url(&state, body.success_url, format!("/app/transactions/{id}?payment=success"));
    let cancel_url = redirect_url(&state, body.cancel_url, format!("/app/transactions/{id}/pay?payment=cancelled"));

    let session = bachs::create_checkout_session(
        &state.http,
        secret_key,
        bachs::CheckoutRequest {
            amount: payment.amount,
            currency: &payment.currency,
            customer_email: &auth.email,
            customer_name: &auth.name,
            success_url: success_url.as_deref(),
            cancel_url: cancel_url.as_deref(),
            transaction_id: &id,
            payment_id: &payment.id,
        },
    )
    .await
    .map_err(|e| AppError::BadGateway(format!("{e:#}")))?;

    let mut db_tx = state.db.begin().await?;
    sqlx::query!(
        r#"UPDATE payments SET
             provider = $2,
             provider_reference = $3,
             status = 'PROCESSING',
             failure_reason = NULL,
             updated_at = now()
           WHERE id = $1"#,
        payment.id,
        bachs::PROVIDER,
        session.checkout_id,
    )
    .execute(&mut *db_tx)
    .await?;
    // Retrying after a failed attempt: reopen the transaction for payment
    // so the webhook's PAYMENT_PENDING -> PAYMENT_CONFIRMED move is legal.
    if txn_status == TransactionStatus::PaymentFailed {
        apply_transition(
            &mut db_tx,
            &id,
            TransactionStatus::PaymentPending,
            Actor::Buyer,
            &auth.name,
            "buyer",
            "Buyer retried payment via Bachs checkout.",
        )
        .await?;
    }
    db_tx.commit().await?;

    Ok(Json(BachsCheckoutResponse {
        checkout_id: session.checkout_id,
        checkout_url: session.checkout_url,
    }))
}

/// Reads the payment record for a transaction, if one exists yet.
pub async fn get_payment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Option<Payment>>> {
    let txn = load_transaction(&state, &id).await?;
    assert_participant_or_admin(&auth, &txn)?;
    Ok(Json(payment_for_txn(&state, &id).await?))
}
