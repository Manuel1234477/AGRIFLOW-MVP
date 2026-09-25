use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dispute {
    pub id: String,
    pub transaction_id: String,
    pub raised_by_id: String,
    pub raised_by_name: String,
    pub reason: String,
    pub description: String,
    pub status: String,
    pub resolution: Option<String>,
    pub resolved_by_id: Option<String>,
    pub resolved_by_name: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaiseDisputeRequest {
    pub transaction_id: String,
    pub reason: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct ResolveDisputeRequest {
    pub decision: String,
    pub outcome: String,
}
