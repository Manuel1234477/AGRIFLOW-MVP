use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub listing_id: String,
    pub demand_id: Option<String>,
    pub buyer_id: String,
    pub buyer_name: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub commodity: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub quantity: Decimal,
    pub unit: String,
    pub quality_grade: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub price_per_unit: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_amount: Decimal,
    pub currency: String,
    pub pickup_location: String,
    pub delivery_location: String,
    pub expected_delivery_date: DateTime<Utc>,
    pub status: String,
    pub payment_id: Option<String>,
    pub logistics_job_id: Option<String>,
    pub dispute_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionEvent {
    pub id: uuid::Uuid,
    pub transaction_id: String,
    pub status: String,
    pub actor: String,
    pub actor_role: String,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TransactionWithHistory {
    #[serde(flatten)]
    pub transaction: Transaction,
    pub history: Vec<TransactionEvent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransactionRequest {
    pub listing_id: String,
    pub demand_id: Option<String>,
    pub quantity: Decimal,
    pub delivery_location: String,
    pub expected_delivery_date: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct TransitionRequest {
    pub to: String,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MockPaymentFailRequest {
    pub reason: Option<String>,
}
