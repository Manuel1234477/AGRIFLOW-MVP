use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MediaRow {
    pub id: String,
    pub listing_id: Option<String>,
    pub uploader_id: String,
    pub kind: String,
    pub content_type: String,
    pub size_bytes: i64,
    pub original_name: String,
    pub storage_key: String,
    pub variants: serde_json::Value,
    pub thumbnail_key: Option<String>,
    pub status: String,
    pub processing_error: Option<String>,
    pub caption: Option<String>,
    pub is_cover: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

/// API shape for one media item. Field names match the frontend's
/// `ListingMedia` type (`src/types/index.ts`), so listings carry it as-is.
/// URLs are same-origin `/api/media/:id/content` paths that redirect to a
/// short-lived presigned bucket URL -- stable enough to store in the page,
/// while the bucket itself stays private.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaView {
    pub id: String,
    pub listing_id: Option<String>,
    #[serde(rename = "type")]
    pub kind: String,
    pub content_type: String,
    pub name: String,
    pub size: i64,
    pub status: String,
    pub url: String,
    pub thumbnail_url: Option<String>,
    /// WebP renditions of an image by name (`small`, `large`), once ready.
    pub variants: serde_json::Map<String, serde_json::Value>,
    pub caption: Option<String>,
    pub is_cover: bool,
    pub sort_order: i32,
    pub processing_error: Option<String>,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresignRequest {
    pub filename: String,
    pub content_type: String,
    pub size_bytes: u64,
    pub listing_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresignResponse {
    pub media_id: String,
    pub upload_url: String,
    pub method: &'static str,
    /// Headers the upload request must send, exactly -- they're signed.
    pub headers: serde_json::Value,
    pub expires_at: DateTime<Utc>,
    pub key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMediaRequest {
    pub caption: Option<String>,
    pub is_cover: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ContentQuery {
    pub variant: Option<String>,
}
