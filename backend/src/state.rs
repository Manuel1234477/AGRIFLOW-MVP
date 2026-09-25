use std::sync::Arc;

use sqlx::PgPool;
use tokio::sync::Semaphore;

use crate::config::Config;
use crate::email::Mailer;
use crate::storage::Storage;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub mailer: Mailer,
    /// Shared HTTP client for outbound provider calls (Bachs).
    pub http: reqwest::Client,
    /// Listing media bucket; `None` when `S3_*` isn't configured.
    pub storage: Option<Storage>,
    /// Caps concurrent ffmpeg media-processing jobs.
    pub media_jobs: Arc<Semaphore>,
}
