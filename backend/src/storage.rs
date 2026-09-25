//! S3-compatible object storage for listing media (issue #32).
//!
//! Works with any S3 API: Railway Buckets in production, MinIO locally, AWS
//! S3 or Cloudflare R2 by changing env vars. Requests are presigned with
//! `rusty-s3` and sent with the shared `reqwest` client; the browser uploads
//! and downloads directly against the bucket via presigned URLs, so file
//! bytes only pass through this service during processing.

use std::path::Path;
use std::time::Duration;

use rusty_s3::actions::{DeleteObject, GetObject, HeadObject, PutObject, S3Action};
use rusty_s3::{Bucket, Credentials, UrlStyle};
use url::Url;

/// Presigned requests the server itself sends only need to live long enough
/// to be sent.
const SERVER_SIDE_TTL: Duration = Duration::from_secs(300);

#[derive(Clone)]
pub struct Storage {
    bucket: Bucket,
    credentials: Credentials,
    http: reqwest::Client,
}

#[derive(Clone)]
pub struct StorageConfig {
    pub endpoint: String,
    pub bucket: String,
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    /// Path-style (`endpoint/bucket/key`) instead of virtual-hosted
    /// (`bucket.endpoint/key`). MinIO needs it; Railway Buckets created
    /// after mid-2025 don't.
    pub path_style: bool,
}

pub struct ObjectInfo {
    pub size: u64,
}

impl Storage {
    pub fn new(cfg: &StorageConfig, http: reqwest::Client) -> anyhow::Result<Self> {
        let endpoint: Url = cfg.endpoint.parse()?;
        let style = if cfg.path_style { UrlStyle::Path } else { UrlStyle::VirtualHost };
        let bucket = Bucket::new(endpoint, style, cfg.bucket.clone(), cfg.region.clone())?;
        let credentials = Credentials::new(cfg.access_key_id.clone(), cfg.secret_access_key.clone());
        Ok(Self { bucket, credentials, http })
    }

    /// URL a client can `PUT` exactly one file to. `Content-Type` and
    /// `Content-Length` are part of the signature, so the bucket rejects an
    /// upload of any other type or size than the one we validated.
    pub fn presign_put(&self, key: &str, content_type: &str, size: u64, ttl: Duration) -> Url {
        let size = size.to_string();
        let mut action = PutObject::new(&self.bucket, Some(&self.credentials), key);
        action.headers_mut().insert("content-type", content_type.to_string());
        action.headers_mut().insert("content-length", size);
        action.sign(ttl)
    }

    /// Time-limited download URL. `response-content-type` makes the bucket
    /// serve the object as the type we validated, whatever the uploader sent.
    pub fn presign_get(&self, key: &str, content_type: &str, ttl: Duration) -> Url {
        let mut action = GetObject::new(&self.bucket, Some(&self.credentials), key);
        action.query_mut().insert("response-content-type", content_type.to_string());
        action.sign(ttl)
    }

    /// Size and type of an object, or `None` if it doesn't exist.
    pub async fn head(&self, key: &str) -> anyhow::Result<Option<ObjectInfo>> {
        let url = HeadObject::new(&self.bucket, Some(&self.credentials), key).sign(SERVER_SIDE_TTL);
        let res = self.http.head(url).send().await?;
        if res.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        let res = res.error_for_status()?;
        let size = res
            .headers()
            .get("content-length")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        Ok(Some(ObjectInfo { size }))
    }

    /// Streams an object to a local file (used before handing it to ffmpeg).
    pub async fn download_to(&self, key: &str, dest: &Path) -> anyhow::Result<()> {
        use tokio::io::AsyncWriteExt;
        let url = GetObject::new(&self.bucket, Some(&self.credentials), key).sign(SERVER_SIDE_TTL);
        let mut res = self.http.get(url).send().await?.error_for_status()?;
        let mut file = tokio::fs::File::create(dest).await?;
        while let Some(chunk) = res.chunk().await? {
            file.write_all(&chunk).await?;
        }
        file.flush().await?;
        Ok(())
    }

    pub async fn put_bytes(&self, key: &str, content_type: &str, bytes: Vec<u8>) -> anyhow::Result<()> {
        let mut action = PutObject::new(&self.bucket, Some(&self.credentials), key);
        action.headers_mut().insert("content-type", content_type.to_string());
        let url = action.sign(SERVER_SIDE_TTL);
        self.http
            .put(url)
            .header("content-type", content_type)
            .body(bytes)
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    /// Replaces the bucket's CORS rules so browsers on `origins` can `PUT`
    /// uploads (and read media) directly. S3 buckets reject cross-origin
    /// requests until this is set, and Railway exposes no other way to set it.
    pub async fn put_cors(&self, origins: &[String]) -> anyhow::Result<()> {
        use base64::Engine;
        use md5::{Digest, Md5};

        let escape = |s: &str| s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
        let allowed: String = origins
            .iter()
            .map(|o| format!("<AllowedOrigin>{}</AllowedOrigin>", escape(o)))
            .collect();
        let xml = format!(
            "<CORSConfiguration><CORSRule>{allowed}\
             <AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>\
             <AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader>\
             <MaxAgeSeconds>3000</MaxAgeSeconds></CORSRule></CORSConfiguration>"
        );
        // PutBucketCors requires a body checksum.
        let md5 = base64::engine::general_purpose::STANDARD.encode(Md5::digest(xml.as_bytes()));

        // A bucket-level `PUT ?cors`: PutObject with an empty key signs the
        // bucket's base URL.
        let mut action = PutObject::new(&self.bucket, Some(&self.credentials), "");
        action.query_mut().insert("cors", "");
        action.headers_mut().insert("content-md5", md5.clone());
        let url = action.sign(SERVER_SIDE_TTL);
        let res = self
            .http
            .put(url)
            .header("content-md5", md5)
            .header("content-type", "application/xml")
            .body(xml)
            .send()
            .await?;
        let status = res.status();
        if !status.is_success() {
            let detail = res.text().await.unwrap_or_default();
            anyhow::bail!("PutBucketCors failed ({status}): {detail}");
        }
        Ok(())
    }

    /// Idempotent: deleting a missing object succeeds.
    pub async fn delete(&self, key: &str) -> anyhow::Result<()> {
        let url = DeleteObject::new(&self.bucket, Some(&self.credentials), key).sign(SERVER_SIDE_TTL);
        let res = self.http.delete(url).send().await?;
        if res.status() != reqwest::StatusCode::NOT_FOUND {
            res.error_for_status()?;
        }
        Ok(())
    }
}
