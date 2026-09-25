mod auth;
mod bachs;
mod config;
mod email;
mod error;
mod ids;
mod models;
mod routes;
mod state;
mod state_machine;
mod validation;

use sqlx::postgres::PgPoolOptions;

use config::Config;
use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let config = Config::from_env()?;
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&db).await?;

    let addr = config.server_addr;
    let mailer = email::Mailer::new(config.resend_api_key.clone(), config.email_from.clone());
    if config.bachs_secret_key.is_none() {
        tracing::warn!("BACHS_SECRET_KEY is not set — Bachs checkout is disabled");
    }
    if config.bachs_webhook_secret.is_none() {
        tracing::warn!("BACHS_WEBHOOK_SECRET is not set — Bachs webhooks will be rejected");
    }
    let state = AppState { db, config, mailer, http: reqwest::Client::new() };
    let app = routes::build(state);

    tracing::info!("agriflow-api listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
