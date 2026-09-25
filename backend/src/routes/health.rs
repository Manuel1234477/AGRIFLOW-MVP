//! `GET /api/health` (issue #40) -- public, no auth. Actually checks DB
//! connectivity rather than returning a hardcoded `ok`, since the point of
//! a platform health check is to catch the case where the process is up
//! but can't reach its database.

use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use serde_json::json;

use crate::state::AppState;

pub async fn health(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query_scalar!("SELECT 1").fetch_one(&state.db).await {
        Ok(_) => (StatusCode::OK, Json(json!({ "status": "ok", "db": "connected" }))),
        Err(e) => {
            tracing::error!(error = %e, "health check: database unreachable");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "status": "error", "db": "disconnected" })),
            )
        }
    }
}
