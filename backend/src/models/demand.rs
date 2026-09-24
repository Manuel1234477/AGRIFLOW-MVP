use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DemandStatus {
    Open,
    Matched,
    Fulfilled,
    Closed,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DemandRequest {
    pub id: String,
    pub buyer_id: String,
    pub buyer_name: String,
    pub commodity: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub quantity: Decimal,
    pub unit: String,
    pub quality_grade: String,
    pub destination_location: String,
    pub required_by_date: DateTime<Utc>,
    #[serde(with = "rust_decimal::serde::float")]
    pub indicative_budget: Decimal,
    pub currency: String,
    pub notes: Option<String>,
    pub status: DemandStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDemandRequest {
    pub commodity: String,
    pub quantity: Decimal,
    pub unit: String,
    pub quality_grade: String,
    pub destination_location: String,
    pub required_by_date: DateTime<Utc>,
    pub indicative_budget: Decimal,
    pub currency: Option<String>,
    pub notes: Option<String>,
}
