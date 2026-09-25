use axum::{
    Json,
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::media::{self, DOWNLOAD_URL_TTL, UPLOAD_URL_TTL};
use crate::models::media::{ContentQuery, MediaRow, MediaView, PresignRequest, PresignResponse, UpdateMediaRequest};
use crate::models::user::UserRole;
use crate::state::AppState;
use crate::storage::Storage;

fn storage(state: &AppState) -> AppResult<&Storage> {
    state
        .storage
        .as_ref()
        .ok_or_else(|| AppError::ServiceUnavailable("Media storage is not configured on this server.".into()))
}

async fn load(state: &AppState, id: &str) -> AppResult<MediaRow> {
    media::load(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Media not found.".into()))
}

/// The supplier who uploaded it, or an admin.
fn assert_can_manage(auth: &AuthUser, row: &MediaRow) -> AppResult<()> {
    if auth.role == UserRole::Admin || auth.user_id == row.uploader_id {
        Ok(())
    } else {
        Err(AppError::Forbidden("You can only manage media you uploaded.".into()))
    }
}

/// Validates an upload and returns a presigned PUT URL for it. The URL is
/// bound to the declared `Content-Type` and exact size, and expires in 15
/// minutes. With `listingId` the media is attached to that (owned) listing
/// immediately; without it, it waits to be attached via `POST /listings`'s
/// `mediaIds`.
pub async fn presigned_url(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<PresignRequest>,
) -> AppResult<Json<PresignResponse>> {
    auth.require_role(UserRole::Supplier)?;
    let storage = storage(&state)?;
    let (kind, ext) = media::classify(&body.content_type, body.size_bytes).map_err(AppError::BadRequest)?;
    let name = media::display_name(&body.filename);

    if let Some(listing_id) = &body.listing_id {
        let owner = sqlx::query_scalar!("SELECT supplier_id FROM supply_listings WHERE id = $1", listing_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Listing not found.".into()))?;
        if owner != auth.user_id {
            return Err(AppError::Forbidden("You can only add media to your own listings.".into()));
        }
        let count = sqlx::query_scalar!(
            r#"SELECT count(*) as "count!" FROM listing_media WHERE listing_id = $1 AND status <> 'failed'"#,
            listing_id,
        )
        .fetch_one(&state.db)
        .await?;
        if count >= media::MAX_MEDIA_PER_LISTING {
            return Err(AppError::Conflict(format!(
                "A listing can have at most {} photos and videos.",
                media::MAX_MEDIA_PER_LISTING
            )));
        }
    } else {
        let count = sqlx::query_scalar!(
            r#"SELECT count(*) as "count!" FROM listing_media
               WHERE uploader_id = $1 AND listing_id IS NULL AND status <> 'failed'"#,
            auth.user_id,
        )
        .fetch_one(&state.db)
        .await?;
        if count >= media::MAX_UNATTACHED_PER_UPLOADER {
            return Err(AppError::Conflict(
                "Too many uploads not yet attached to a listing. Publish the listing or remove some first.".into(),
            ));
        }
    }

    // Unguessable, unlike the 5-digit ids elsewhere: the id is also the
    // storage key and the public content URL.
    let media_id = uuid::Uuid::new_v4().simple().to_string();
    let key = media::storage_key(body.listing_id.as_deref(), &auth.user_id, kind, &media_id, ext);
    let size = i64::try_from(body.size_bytes).map_err(|_| AppError::BadRequest("File is too large.".into()))?;

    sqlx::query!(
        r#"INSERT INTO listing_media
             (id, listing_id, uploader_id, kind, content_type, size_bytes, original_name, storage_key, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                   COALESCE((SELECT max(sort_order) + 1 FROM listing_media WHERE listing_id = $2), 0))"#,
        media_id,
        body.listing_id,
        auth.user_id,
        kind.as_str(),
        body.content_type,
        size,
        name,
        key,
    )
    .execute(&state.db)
    .await?;

    let upload_url = storage.presign_put(&key, &body.content_type, body.size_bytes, UPLOAD_URL_TTL);
    Ok(Json(PresignResponse {
        media_id,
        upload_url: upload_url.to_string(),
        method: "PUT",
        headers: json!({ "Content-Type": body.content_type }),
        expires_at: chrono::Utc::now() + UPLOAD_URL_TTL,
        key,
    }))
}

/// Called after the browser's PUT succeeds. Checks the object really is in
/// the bucket at the declared size, then queues processing. Idempotent.
pub async fn complete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<MediaView>> {
    let storage = storage(&state)?;
    let row = load(&state, &id).await?;
    assert_can_manage(&auth, &row)?;
    if row.status != "pending" {
        return Ok(Json(media::view(&row)));
    }

    let info = storage
        .head(&row.storage_key)
        .await
        .map_err(|e| AppError::BadGateway(format!("storage HEAD failed: {e:#}")))?
        .ok_or_else(|| AppError::Conflict("The file hasn't been uploaded yet. PUT it to the upload URL first.".into()))?;

    if i64::try_from(info.size).ok() != Some(row.size_bytes) {
        media::delete_objects(storage, &row)
            .await
            .map_err(|e| AppError::BadGateway(format!("{e:#}")))?;
        sqlx::query!(
            "UPDATE listing_media SET status = 'failed', processing_error = 'Uploaded size did not match.', updated_at = now() WHERE id = $1",
            row.id,
        )
        .execute(&state.db)
        .await?;
        return Err(AppError::BadRequest("Uploaded file size did not match the declared size.".into()));
    }

    let row = sqlx::query_as!(
        MediaRow,
        r#"UPDATE listing_media SET status = 'processing', updated_at = now()
           WHERE id = $1 AND status = 'pending'
           RETURNING id, listing_id, uploader_id, kind, content_type, size_bytes, original_name,
                     storage_key, variants, thumbnail_key, status, processing_error, caption,
                     is_cover, sort_order, created_at"#,
        row.id,
    )
    .fetch_optional(&state.db)
    .await?;
    let Some(row) = row else {
        // A concurrent `complete` won the race; report its result.
        return Ok(Json(media::view(&load(&state, &id).await?)));
    };
    media::spawn_processing(state.clone(), row.id.clone());
    // Added to an existing listing without a cover: this photo may become it.
    let row = match &row.listing_id {
        Some(listing_id) => {
            media::ensure_cover(&state.db, listing_id).await?;
            load(&state, &id).await?
        }
        None => row,
    };
    Ok(Json(media::view(&row)))
}

/// Status of one upload, for the uploader to poll while it processes.
pub async fn get_one(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<MediaView>> {
    let row = load(&state, &id).await?;
    assert_can_manage(&auth, &row)?;
    Ok(Json(media::view(&row)))
}

/// Redirects to a 1-hour presigned URL for the file. Unauthenticated, like
/// listing browsing, so `<img src>` / `<video src>` can use it directly;
/// only uploaded (processing/ready) media is served.
pub async fn content(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<ContentQuery>,
) -> AppResult<Response> {
    let storage = storage(&state)?;
    let row = load(&state, &id).await?;
    let not_found = || AppError::NotFound("Media not found.".into());

    let (key, content_type) = match query.variant.as_deref() {
        None | Some("original") if matches!(row.status.as_str(), "processing" | "ready") => {
            (row.storage_key.clone(), row.content_type.clone())
        }
        Some("thumbnail") if row.status == "ready" => (row.thumbnail_key.clone().ok_or_else(not_found)?, "image/webp".into()),
        Some(name) if row.status == "ready" => (
            row.variants.get(name).and_then(|v| v.as_str()).ok_or_else(not_found)?.to_string(),
            "image/webp".into(),
        ),
        _ => return Err(not_found()),
    };

    let url = storage.presign_get(&key, &content_type, DOWNLOAD_URL_TTL);
    Ok((
        StatusCode::FOUND,
        [
            (header::LOCATION, url.to_string()),
            // Shorter than the presigned URL's lifetime, so a cached
            // redirect never points at an expired signature.
            (header::CACHE_CONTROL, "public, max-age=1800".to_string()),
        ],
    )
        .into_response())
}

/// Updates the caption, cover flag, or display order.
pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateMediaRequest>,
) -> AppResult<Json<MediaView>> {
    let row = load(&state, &id).await?;
    assert_can_manage(&auth, &row)?;

    let caption = body.caption.map(|c| c.trim().to_string());
    if caption.as_ref().is_some_and(|c| c.chars().count() > 300) {
        return Err(AppError::BadRequest("Caption must be at most 300 characters.".into()));
    }
    if body.is_cover == Some(true) {
        if row.listing_id.is_none() {
            return Err(AppError::BadRequest("Attach the media to a listing before making it the cover.".into()));
        }
        if row.kind != "image" {
            return Err(AppError::BadRequest("Only a photo can be the cover.".into()));
        }
    }

    let mut db_tx = state.db.begin().await?;
    if body.is_cover == Some(true) {
        sqlx::query!(
            "UPDATE listing_media SET is_cover = FALSE, updated_at = now() WHERE listing_id = $1 AND is_cover AND id <> $2",
            row.listing_id,
            row.id,
        )
        .execute(&mut *db_tx)
        .await?;
    }
    let row = sqlx::query_as!(
        MediaRow,
        r#"UPDATE listing_media SET
             caption = CASE WHEN $2::text IS NULL THEN caption ELSE NULLIF($2, '') END,
             is_cover = COALESCE($3, is_cover),
             sort_order = COALESCE($4, sort_order),
             updated_at = now()
           WHERE id = $1
           RETURNING id, listing_id, uploader_id, kind, content_type, size_bytes, original_name,
                     storage_key, variants, thumbnail_key, status, processing_error, caption,
                     is_cover, sort_order, created_at"#,
        row.id,
        caption,
        body.is_cover,
        body.sort_order,
    )
    .fetch_one(&mut *db_tx)
    .await?;
    db_tx.commit().await?;

    Ok(Json(media::view(&row)))
}

/// Deletes the file (and its derivatives) from the bucket, then the row.
pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let storage = storage(&state)?;
    let row = load(&state, &id).await?;
    assert_can_manage(&auth, &row)?;

    media::delete_objects(storage, &row)
        .await
        .map_err(|e| AppError::BadGateway(format!("{e:#}")))?;
    sqlx::query!("DELETE FROM listing_media WHERE id = $1", row.id)
        .execute(&state.db)
        .await?;
    if let (true, Some(listing_id)) = (row.is_cover, &row.listing_id) {
        media::ensure_cover(&state.db, listing_id).await?;
    }
    Ok(StatusCode::NO_CONTENT)
}
