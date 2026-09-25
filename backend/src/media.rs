//! Listing media (issue #32): upload validation, storage keys, the ffmpeg
//! processing pipeline, and the shapes listings embed.
//!
//! Flow: `POST /media/presigned-url` validates type/size and returns a
//! presigned PUT → the browser uploads straight to the bucket → `POST
//! /media/:id/complete` verifies the object and queues processing here.
//! Processing runs every upload through ffmpeg, which both produces the
//! derivatives (WebP renditions, video first-frame thumbnail) and proves
//! the file really is the image/video it claims to be. Anything ffmpeg
//! can't decode is deleted from the bucket and marked `failed`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::json;
use tokio::process::Command;

use crate::models::media::{MediaRow, MediaView};
use crate::state::AppState;
use crate::storage::Storage;

pub const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024;
pub const MAX_VIDEO_BYTES: u64 = 80 * 1024 * 1024;
/// Matches the frontend uploader's `maxFiles`.
pub const MAX_MEDIA_PER_LISTING: i64 = 8;
/// Uploads not yet attached to a listing, per supplier -- bounds what an
/// abandoned create-listing form (or abuse) can leave in the bucket.
pub const MAX_UNATTACHED_PER_UPLOADER: i64 = 20;
pub const UPLOAD_URL_TTL: Duration = Duration::from_secs(15 * 60);
pub const DOWNLOAD_URL_TTL: Duration = Duration::from_secs(60 * 60);
/// Unattached uploads older than this are deleted by `cleanup_abandoned`.
const ABANDONED_AFTER_HOURS: i32 = 24;
/// Wall-clock cap on one ffmpeg run.
const FFMPEG_TIMEOUT: Duration = Duration::from_secs(120);

/// WebP renditions generated for every image: (name, max width).
const IMAGE_VARIANTS: &[(&str, u32)] = &[("small", 480), ("large", 1280)];
const VIDEO_THUMBNAIL_WIDTH: u32 = 960;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Image,
    Video,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Image => "image",
            Kind::Video => "video",
        }
    }
}

/// Validates an upload's declared type and size against issue #32's
/// allow-list and limits. Returns the media kind and file extension.
pub fn classify(content_type: &str, size_bytes: u64) -> Result<(Kind, &'static str), String> {
    let (kind, ext) = match content_type {
        "image/jpeg" => (Kind::Image, "jpg"),
        "image/png" => (Kind::Image, "png"),
        "image/webp" => (Kind::Image, "webp"),
        "video/mp4" => (Kind::Video, "mp4"),
        "video/webm" => (Kind::Video, "webm"),
        "video/quicktime" => (Kind::Video, "mov"),
        other => {
            return Err(format!(
                "Unsupported file type '{other}'. Allowed: JPEG, PNG, WebP images and MP4, WebM, MOV videos."
            ));
        }
    };
    let max = match kind {
        Kind::Image => MAX_IMAGE_BYTES,
        Kind::Video => MAX_VIDEO_BYTES,
    };
    if size_bytes == 0 {
        return Err("File is empty.".into());
    }
    if size_bytes > max {
        return Err(format!("File is too large. Max size is {} MB for {}s.", max / 1024 / 1024, kind.as_str()));
    }
    Ok((kind, ext))
}

/// `listings/{listingId}/images/{id}.jpg`, per issue #32. Uploads made
/// before the listing exists live under `listings/pending/{uploaderId}/...`
/// and keep that key once attached -- the row's `listing_id` is what ties
/// them to the listing, and moving objects would race processing.
pub fn storage_key(listing_id: Option<&str>, uploader_id: &str, kind: Kind, media_id: &str, ext: &str) -> String {
    let scope = match listing_id {
        Some(id) => id.to_string(),
        None => format!("pending/{uploader_id}"),
    };
    format!("listings/{scope}/{}s/{media_id}.{ext}", kind.as_str())
}

/// `listings/.../images/{id}.jpg` → `listings/.../images/{id}-small.webp`.
fn derivative_key(original: &str, name: &str) -> String {
    let stem = original.rsplit_once('.').map_or(original, |(stem, _)| stem);
    format!("{stem}-{name}.webp")
}

/// Keeps the uploader's filename for display only; it never reaches a
/// storage key.
pub fn display_name(filename: &str) -> String {
    let name = filename.rsplit(['/', '\\']).next().unwrap_or("").trim();
    let name: String = name.chars().filter(|c| !c.is_control()).take(200).collect();
    if name.is_empty() { "upload".into() } else { name }
}

pub fn content_url(id: &str, variant: Option<&str>) -> String {
    match variant {
        Some(v) => format!("/api/media/{id}/content?variant={v}"),
        None => format!("/api/media/{id}/content"),
    }
}

pub fn view(row: &MediaRow) -> MediaView {
    let ready = row.status == "ready";
    let variants: serde_json::Map<String, serde_json::Value> = row
        .variants
        .as_object()
        .into_iter()
        .flatten()
        .filter(|_| ready)
        .map(|(name, _)| (name.clone(), json!(content_url(&row.id, Some(name)))))
        .collect();
    let has = |name: &str| variants.contains_key(name);

    let (url, thumbnail_url) = if row.kind == "image" {
        (
            content_url(&row.id, has("large").then_some("large")),
            Some(content_url(&row.id, has("small").then_some("small"))),
        )
    } else {
        (
            content_url(&row.id, None),
            (ready && row.thumbnail_key.is_some()).then(|| content_url(&row.id, Some("thumbnail"))),
        )
    };

    MediaView {
        id: row.id.clone(),
        listing_id: row.listing_id.clone(),
        kind: row.kind.clone(),
        content_type: row.content_type.clone(),
        name: row.original_name.clone(),
        size: row.size_bytes,
        status: row.status.clone(),
        url,
        thumbnail_url,
        variants,
        caption: row.caption.clone(),
        is_cover: row.is_cover,
        sort_order: row.sort_order,
        processing_error: row.processing_error.clone(),
        uploaded_at: row.created_at,
    }
}

/// Every stored object for a row: the original plus any derivatives.
pub fn all_keys(row: &MediaRow) -> Vec<String> {
    let mut keys = vec![row.storage_key.clone()];
    if let Some(map) = row.variants.as_object() {
        keys.extend(map.values().filter_map(|v| v.as_str().map(str::to_owned)));
    }
    keys.extend(row.thumbnail_key.clone());
    keys
}

/// Media shown on listings, grouped by listing id: cover first, then the
/// supplier's order. Pending (never uploaded) and failed items are hidden.
pub async fn for_listings(db: &sqlx::PgPool, listing_ids: &[String]) -> sqlx::Result<HashMap<String, Vec<MediaView>>> {
    let rows = sqlx::query_as!(
        MediaRow,
        r#"SELECT id, listing_id, uploader_id, kind, content_type, size_bytes, original_name,
                  storage_key, variants, thumbnail_key, status, processing_error, caption,
                  is_cover, sort_order, created_at
           FROM listing_media
           WHERE listing_id = ANY($1) AND status IN ('processing', 'ready')
           ORDER BY listing_id, is_cover DESC, sort_order, created_at"#,
        listing_ids,
    )
    .fetch_all(db)
    .await?;

    let mut grouped: HashMap<String, Vec<MediaView>> = HashMap::new();
    for row in &rows {
        if let Some(listing_id) = &row.listing_id {
            grouped.entry(listing_id.clone()).or_default().push(view(row));
        }
    }
    Ok(grouped)
}

pub async fn load(db: &sqlx::PgPool, id: &str) -> sqlx::Result<Option<MediaRow>> {
    sqlx::query_as!(
        MediaRow,
        r#"SELECT id, listing_id, uploader_id, kind, content_type, size_bytes, original_name,
                  storage_key, variants, thumbnail_key, status, processing_error, caption,
                  is_cover, sort_order, created_at
           FROM listing_media WHERE id = $1"#,
        id,
    )
    .fetch_optional(db)
    .await
}

/// Queues processing for one media item, bounded by the shared semaphore so
/// a burst of uploads can't run unbounded ffmpeg processes.
pub fn spawn_processing(state: AppState, media_id: String) {
    tokio::spawn(async move {
        let _permit = match state.media_jobs.clone().acquire_owned().await {
            Ok(p) => p,
            Err(_) => return,
        };
        if let Err(e) = process(&state, &media_id).await {
            tracing::error!(media_id, error = %format!("{e:#}"), "media processing failed");
        }
    });
}

/// Re-queues items left `processing` by a restart mid-job.
pub async fn resume_processing(state: &AppState) {
    match sqlx::query_scalar!("SELECT id FROM listing_media WHERE status = 'processing'")
        .fetch_all(&state.db)
        .await
    {
        Ok(ids) => {
            if !ids.is_empty() {
                tracing::info!(count = ids.len(), "resuming media processing");
            }
            for id in ids {
                spawn_processing(state.clone(), id);
            }
        }
        Err(e) => tracing::error!(error = %e, "could not load media awaiting processing"),
    }
}

/// Hourly: deletes uploads that were never attached to a listing.
pub fn spawn_cleanup(state: AppState) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(3600));
        loop {
            tick.tick().await;
            if let Err(e) = cleanup_abandoned(&state).await {
                tracing::error!(error = %format!("{e:#}"), "media cleanup failed");
            }
        }
    });
}

async fn cleanup_abandoned(state: &AppState) -> anyhow::Result<()> {
    let Some(storage) = &state.storage else { return Ok(()) };
    let rows = sqlx::query_as!(
        MediaRow,
        r#"SELECT id, listing_id, uploader_id, kind, content_type, size_bytes, original_name,
                  storage_key, variants, thumbnail_key, status, processing_error, caption,
                  is_cover, sort_order, created_at
           FROM listing_media
           WHERE listing_id IS NULL AND status <> 'processing'
             AND created_at < now() - make_interval(hours => $1)"#,
        ABANDONED_AFTER_HOURS,
    )
    .fetch_all(&state.db)
    .await?;
    for row in rows {
        delete_objects(storage, &row).await?;
        sqlx::query!("DELETE FROM listing_media WHERE id = $1", row.id)
            .execute(&state.db)
            .await?;
    }
    Ok(())
}

pub async fn delete_objects(storage: &Storage, row: &MediaRow) -> anyhow::Result<()> {
    for key in all_keys(row) {
        storage.delete(&key).await?;
    }
    Ok(())
}

/// Why processing stopped: the upload itself is bad (delete it), or the
/// pipeline hit an infrastructure problem (keep the original).
enum Failure {
    Rejected(String),
    Internal(anyhow::Error),
}

async fn process(state: &AppState, media_id: &str) -> anyhow::Result<()> {
    let Some(storage) = &state.storage else { return Ok(()) };
    let Some(row) = load(&state.db, media_id).await? else { return Ok(()) };
    if row.status != "processing" {
        return Ok(());
    }

    let workdir = std::env::temp_dir().join(format!("agriflow-media-{}", row.id));
    tokio::fs::create_dir_all(&workdir).await?;
    let outcome = generate_derivatives(storage, &row, &workdir).await;
    let _ = tokio::fs::remove_dir_all(&workdir).await;

    match outcome {
        Ok((variants, thumbnail_key)) => {
            let updated = sqlx::query!(
                r#"UPDATE listing_media SET status = 'ready', variants = $2, thumbnail_key = $3,
                     processing_error = NULL, updated_at = now()
                   WHERE id = $1 AND status = 'processing'"#,
                row.id,
                variants,
                thumbnail_key,
            )
            .execute(&state.db)
            .await?
            .rows_affected();
            // Deleted while processing: its original is gone already, so
            // don't leave the derivatives just uploaded behind.
            if updated == 0 {
                let orphaned = MediaRow { variants, thumbnail_key, ..row };
                delete_objects(storage, &orphaned).await?;
            }
        }
        Err(Failure::Rejected(reason)) => {
            tracing::warn!(media_id, reason, "upload rejected by processing; deleting");
            delete_objects(storage, &row).await?;
            mark_failed(state, &row.id, &reason).await?;
        }
        Err(Failure::Internal(e)) => {
            mark_failed(state, &row.id, "Processing error; please upload the file again.").await?;
            return Err(e);
        }
    }
    Ok(())
}

async fn mark_failed(state: &AppState, id: &str, reason: &str) -> sqlx::Result<()> {
    sqlx::query!(
        "UPDATE listing_media SET status = 'failed', processing_error = $2, updated_at = now() WHERE id = $1",
        id,
        reason,
    )
    .execute(&state.db)
    .await?;
    Ok(())
}

async fn generate_derivatives(
    storage: &Storage,
    row: &MediaRow,
    workdir: &Path,
) -> Result<(serde_json::Value, Option<String>), Failure> {
    let input = workdir.join("original");
    storage.download_to(&row.storage_key, &input).await.map_err(Failure::Internal)?;

    let mut variants = serde_json::Map::new();
    let mut thumbnail_key = None;
    let renditions: Vec<(&str, u32)> = if row.kind == "image" {
        IMAGE_VARIANTS.to_vec()
    } else {
        vec![("thumbnail", VIDEO_THUMBNAIL_WIDTH)]
    };

    for (name, width) in renditions {
        let output = workdir.join(format!("{name}.webp"));
        webp_frame(&input, &output, width).await?;
        let bytes = tokio::fs::read(&output).await.map_err(|e| Failure::Internal(e.into()))?;
        let key = derivative_key(&row.storage_key, name);
        storage.put_bytes(&key, "image/webp", bytes).await.map_err(Failure::Internal)?;
        if row.kind == "image" {
            variants.insert(name.to_string(), json!(key));
        } else {
            thumbnail_key = Some(key);
        }
    }
    Ok((serde_json::Value::Object(variants), thumbnail_key))
}

/// Decodes the first frame of `input` (a still image or a video) and writes
/// it as a WebP no wider than `max_width`, keeping the aspect ratio. Fails
/// with `Rejected` if ffmpeg can't decode the input as an image/video.
async fn webp_frame(input: &PathBuf, output: &PathBuf, max_width: u32) -> Result<(), Failure> {
    let scale = format!("scale='min({max_width},iw)':-2");
    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-nostdin", "-v", "error", "-y", "-i"])
        .arg(input)
        .args(["-map", "0:v:0", "-frames:v", "1", "-vf", &scale, "-c:v", "libwebp", "-quality", "80"])
        .arg(output)
        .kill_on_drop(true);

    let result = tokio::time::timeout(FFMPEG_TIMEOUT, cmd.output()).await;
    let out = match result {
        Err(_) => return Err(Failure::Rejected("File took too long to process.".into())),
        Ok(Err(e)) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(Failure::Internal(anyhow::anyhow!("ffmpeg is not installed")));
        }
        Ok(Err(e)) => return Err(Failure::Internal(e.into())),
        Ok(Ok(out)) => out,
    };
    let produced = tokio::fs::metadata(output).await.map(|m| m.len() > 0).unwrap_or(false);
    if !out.status.success() || !produced {
        let detail = String::from_utf8_lossy(&out.stderr);
        tracing::debug!(detail = %detail.trim(), "ffmpeg could not decode upload");
        return Err(Failure::Rejected("The file could not be read as an image or video.".into()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_enforces_allow_list_and_limits() {
        assert_eq!(classify("image/jpeg", 1).unwrap(), (Kind::Image, "jpg"));
        assert_eq!(classify("video/quicktime", MAX_VIDEO_BYTES).unwrap(), (Kind::Video, "mov"));
        assert!(classify("image/jpeg", MAX_IMAGE_BYTES + 1).is_err());
        assert!(classify("video/mp4", MAX_VIDEO_BYTES + 1).is_err());
        assert!(classify("image/png", 0).is_err());
        assert!(classify("image/svg+xml", 10).is_err());
        assert!(classify("text/html", 10).is_err());
    }

    #[test]
    fn keys_follow_issue_layout() {
        assert_eq!(storage_key(Some("SUP-1"), "USR-SUP-1", Kind::Image, "m1", "jpg"), "listings/SUP-1/images/m1.jpg");
        assert_eq!(
            storage_key(None, "USR-SUP-1", Kind::Video, "m2", "mp4"),
            "listings/pending/USR-SUP-1/videos/m2.mp4"
        );
        assert_eq!(derivative_key("listings/SUP-1/images/m1.jpg", "small"), "listings/SUP-1/images/m1-small.webp");
    }

    #[test]
    fn display_name_strips_paths_and_control_chars() {
        assert_eq!(display_name("../../etc/passwd"), "passwd");
        assert_eq!(display_name(r"C:\photos\maize.jpg"), "maize.jpg");
        assert_eq!(display_name("a\u{0}b.png"), "ab.png");
        assert_eq!(display_name("  "), "upload");
    }
}
