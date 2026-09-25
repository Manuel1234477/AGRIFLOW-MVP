use std::str::FromStr;

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use rust_decimal::Decimal;
use serde::Deserialize;

use crate::bachs;
use crate::error::{AppError, AppResult};
use crate::models::payment::Payment;
use crate::routes::transactions::{apply_transition, load_transaction};
use crate::state::AppState;
use crate::state_machine::{Actor, TransactionStatus};

/// Webhook envelope. Parsed leniently on purpose -- Bachs adds fields
/// without notice and treats that as backwards compatible.
#[derive(Debug, Deserialize)]
struct Event {
    id: String,
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    data: EventData,
}

#[derive(Debug, Default, Deserialize)]
struct EventData {
    checkout_id: Option<String>,
    amount: Option<String>,
    currency: Option<String>,
    reason: Option<String>,
    #[serde(default)]
    metadata: serde_json::Map<String, serde_json::Value>,
}

/// Receives Bachs webhook deliveries. This is the only path that can settle
/// a Bachs payment: the signature proves the event came from Bachs, so it
/// acts as `Actor::System`, the same system actor `mock_confirm_payment`
/// stands in for on non-Bachs payments.
///
/// Responses: 2xx tells Bachs to stop retrying, so it is returned for every
/// event that was handled or deliberately ignored. 401 is returned for a bad
/// signature; 5xx (database errors) makes Bachs redeliver later.
pub async fn bachs(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> AppResult<StatusCode> {
    let secret = state.config.bachs_webhook_secret.as_deref().ok_or_else(|| {
        AppError::ServiceUnavailable("Bachs webhooks are not configured on this server.".into())
    })?;
    if !bachs::verify_signature(secret, &headers, &body, chrono::Utc::now().timestamp()) {
        return Err(AppError::Unauthorized("Invalid webhook signature.".into()));
    }

    let payload: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|_| AppError::BadRequest("Webhook body is not valid JSON.".into()))?;
    let event: Event = serde_json::from_value(payload.clone())
        .map_err(|e| AppError::BadRequest(format!("Unrecognised webhook envelope: {e}")))?;

    let settles = matches!(event.event_type.as_str(), "collection.succeeded" | "collection.failed");
    let mut db_tx = state.db.begin().await?;
    let payment = if settles { find_payment(&mut db_tx, &event.data).await? } else { None };
    let inserted = sqlx::query!(
        r#"INSERT INTO bachs_webhook_events (event_id, event_type, payment_id, payload)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (event_id) DO NOTHING"#,
        event.id,
        event.event_type,
        payment.as_ref().map(|p| p.id.clone()),
        payload,
    )
    .execute(&mut *db_tx)
    .await?
    .rows_affected();
    if inserted == 0 {
        tracing::info!(event_id = %event.id, "duplicate Bachs webhook delivery; already processed");
        return Ok(StatusCode::OK);
    }

    let mut queue_logistics = None;
    match (event.event_type.as_str(), payment) {
        (_, None) if settles => {
            // A test delivery from the Bachs portal, or a checkout that
            // wasn't created by this API. Recorded, nothing to settle.
            tracing::warn!(event_id = %event.id, checkout_id = ?event.data.checkout_id,
                "Bachs collection event matches no AgriFlow payment");
        }
        ("collection.succeeded", Some(payment)) => {
            queue_logistics = handle_succeeded(&mut db_tx, &event, &payment).await?;
        }
        ("collection.failed", Some(payment)) => {
            handle_failed(&mut db_tx, &event, &payment).await?;
        }
        (other, _) => {
            tracing::debug!(event_id = %event.id, event_type = other, "ignoring Bachs event type");
        }
    }
    db_tx.commit().await?;

    // Same post-commit step mock_confirm_payment takes; idempotent, so a
    // failure here is retried safely by the next confirm path that runs it.
    if let Some(txn_id) = queue_logistics {
        let txn = load_transaction(&state, &txn_id).await?;
        crate::routes::logistics::create_job_for_transaction(&state, &txn).await?;
    }

    Ok(StatusCode::OK)
}

/// Resolves the payment an event refers to: by the `payment_id` metadata
/// the checkout was created with, falling back to the checkout id stored as
/// the payment's provider reference. Only Bachs-sourced payments match.
/// Locks the row so concurrent deliveries for one payment apply in turn.
async fn find_payment(db_tx: &mut sqlx::PgConnection, data: &EventData) -> AppResult<Option<Payment>> {
    let payment_id = data.metadata.get("payment_id").and_then(|v| v.as_str());
    Ok(sqlx::query_as!(
        Payment,
        r#"SELECT id, transaction_id, payer_id, amount, currency, provider, provider_reference,
                  stellar_tx_hash, status, failure_reason, created_at, updated_at, completed_at
           FROM payments
           WHERE provider = $1 AND (id = $2 OR provider_reference = $3)
           ORDER BY (id = $2) DESC NULLS LAST
           LIMIT 1
           FOR UPDATE"#,
        bachs::PROVIDER,
        payment_id,
        data.checkout_id,
    )
    .fetch_optional(&mut *db_tx)
    .await?)
}

/// Confirms the payment and advances the transaction to LOGISTICS_PENDING.
/// Returns the transaction id when a logistics job should be queued.
async fn handle_succeeded(
    db_tx: &mut sqlx::PgConnection,
    event: &Event,
    payment: &Payment,
) -> AppResult<Option<String>> {
    if payment.status == "CONFIRMED" {
        return Ok(None);
    }

    // Never trust a success event that collected less than was owed, or in
    // a different currency than the payment was opened in.
    let amount = event.data.amount.as_deref().and_then(|a| Decimal::from_str(a).ok());
    let currency_ok = event.data.currency.as_deref() == Some(payment.currency.as_str());
    if !currency_ok || amount.is_none_or(|a| a < payment.amount) {
        tracing::error!(event_id = %event.id, payment_id = %payment.id,
            expected = %payment.amount, expected_currency = %payment.currency,
            got = ?event.data.amount, got_currency = ?event.data.currency,
            "Bachs collection does not cover the payment; not confirming");
        return Ok(None);
    }

    sqlx::query!(
        r#"UPDATE payments SET
             status = 'CONFIRMED',
             provider_reference = COALESCE($2, provider_reference),
             failure_reason = NULL,
             completed_at = COALESCE(completed_at, now()),
             updated_at = now()
           WHERE id = $1"#,
        payment.id,
        event.data.checkout_id,
    )
    .execute(&mut *db_tx)
    .await?;

    let status = current_status(db_tx, &payment.transaction_id).await?;
    let txn_id = payment.transaction_id.as_str();
    match status {
        // A late success for an attempt already reported failed.
        TransactionStatus::PaymentFailed => {
            system_transition(db_tx, txn_id, TransactionStatus::PaymentPending, "Bachs payment succeeded after an earlier failure.").await?;
        }
        TransactionStatus::PaymentPending => {}
        other => {
            // Money was collected but the transaction moved on (e.g. was
            // cancelled). The payment is still recorded as CONFIRMED -- that
            // is what happened -- but the transaction needs a human.
            tracing::error!(event_id = %event.id, transaction_id = txn_id, status = other.as_str(),
                "Bachs payment confirmed for a transaction not awaiting payment; needs manual review");
            return Ok(None);
        }
    }
    system_transition(db_tx, txn_id, TransactionStatus::PaymentConfirmed, "Payment confirmed by Bachs.io.").await?;
    system_transition(db_tx, txn_id, TransactionStatus::LogisticsPending, "Logistics job queued.").await?;
    Ok(Some(payment.transaction_id.clone()))
}

async fn handle_failed(db_tx: &mut sqlx::PgConnection, event: &Event, payment: &Payment) -> AppResult<()> {
    // Once confirmed, a failure for some other attempt changes nothing.
    if payment.status == "CONFIRMED" {
        return Ok(());
    }
    let reason = event.data.reason.clone().unwrap_or_else(|| "Payment failed.".to_string());

    sqlx::query!(
        "UPDATE payments SET status = 'FAILED', failure_reason = $2, updated_at = now() WHERE id = $1",
        payment.id,
        reason,
    )
    .execute(&mut *db_tx)
    .await?;

    if current_status(db_tx, &payment.transaction_id).await? == TransactionStatus::PaymentPending {
        system_transition(db_tx, &payment.transaction_id, TransactionStatus::PaymentFailed, &format!("Payment failed: {reason}")).await?;
    }
    Ok(())
}

async fn current_status(db_tx: &mut sqlx::PgConnection, txn_id: &str) -> AppResult<TransactionStatus> {
    let status = sqlx::query_scalar!("SELECT status FROM transactions WHERE id = $1 FOR UPDATE", txn_id)
        .fetch_one(&mut *db_tx)
        .await?;
    TransactionStatus::from_str(&status).map_err(|e| AppError::Internal(anyhow::anyhow!(e)))
}

async fn system_transition(
    db_tx: &mut sqlx::PgConnection,
    txn_id: &str,
    to: TransactionStatus,
    note: &str,
) -> AppResult<()> {
    apply_transition(db_tx, txn_id, to, Actor::System, "Bachs.io", "system", note).await?;
    Ok(())
}
