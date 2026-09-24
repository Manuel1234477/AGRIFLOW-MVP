use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ListingStatus {
    Active,
    Inactive,
    Sold,
    PendingReview,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplyListing {
    pub id: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub supplier_verified: bool,
    pub commodity: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub quantity: Decimal,
    pub unit: String,
    pub quality_grade: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub price_per_unit: Decimal,
    pub currency: String,
    pub location: String,
    pub availability_date: DateTime<Utc>,
    pub description: String,
    pub status: ListingStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateListingRequest {
    pub commodity: String,
    pub quantity: Decimal,
    pub unit: String,
    pub quality_grade: String,
    pub price_per_unit: Decimal,
    pub currency: Option<String>,
    pub location: String,
    pub availability_date: DateTime<Utc>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateListingRequest {
    pub quantity: Option<Decimal>,
    pub price_per_unit: Option<Decimal>,
    pub description: Option<String>,
    pub status: Option<ListingStatus>,
}
