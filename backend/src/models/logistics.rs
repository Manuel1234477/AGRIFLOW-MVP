use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogisticsJob {
    pub id: String,
    pub transaction_id: String,
    pub provider_id: Option<String>,
    pub provider_name: Option<String>,
    pub commodity: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub quantity: Decimal,
    pub unit: String,
    pub pickup_location: String,
    pub delivery_location: String,
    pub pickup_date: DateTime<Utc>,
    pub expected_delivery_date: DateTime<Utc>,
    #[serde(with = "rust_decimal::serde::float")]
    pub logistics_cost: Decimal,
    pub currency: String,
    pub status: String,
    pub proof_of_delivery: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignProviderRequest {
    pub provider_id: String,
}

/// Mirrors `ProofOfDelivery` in src/types/index.ts exactly -- stored as
/// JSONB on the job row rather than flattened into separate columns.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofOfDelivery {
    pub recipient_name: String,
    pub delivery_note: String,
    pub timestamp: String,
    pub recorded_by: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobStatusRequest {
    pub status: String,
    pub proof_of_delivery: Option<ProofOfDelivery>,
}
