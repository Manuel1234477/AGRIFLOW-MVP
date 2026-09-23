use std::net::SocketAddr;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,
    pub server_addr: SocketAddr,
    /// Shared secret that must be sent as `X-Admin-Registration-Key` to
    /// register an admin. Unset → admin self-registration is disabled.
    pub admin_registration_key: Option<String>,
    /// Resend API key. Unset → outgoing email is skipped (see `email.rs`).
    pub resend_api_key: Option<String>,
    /// Sender for outgoing email, e.g. `AgriFlow <hello@yourdomain.com>`.
    pub email_from: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let database_url = std::env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("DATABASE_URL is not set"))?;
        let jwt_secret =
            std::env::var("JWT_SECRET").map_err(|_| anyhow::anyhow!("JWT_SECRET is not set"))?;
        let jwt_expiry_hours = std::env::var("JWT_EXPIRY_HOURS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(24);
        // Railway (and most PaaS platforms) inject $PORT and expect the app
        // to bind to it; SERVER_ADDR remains the override for local/manual runs.
        let server_addr: SocketAddr = match std::env::var("PORT") {
            Ok(port) => format!("0.0.0.0:{port}").parse()?,
            Err(_) => std::env::var("SERVER_ADDR")
                .unwrap_or_else(|_| "0.0.0.0:8080".to_string())
                .parse()?,
        };

        let non_empty = |name| std::env::var(name).ok().filter(|v| !v.trim().is_empty());
        let admin_registration_key = non_empty("ADMIN_REGISTRATION_KEY");
        let resend_api_key = non_empty("RESEND_API_KEY");
        // Resend's shared test sender works without verifying a domain, but
        // only delivers to the Resend account owner's own address.
        let email_from =
            non_empty("EMAIL_FROM").unwrap_or_else(|| "AgriFlow <onboarding@resend.dev>".into());

        Ok(Self {
            database_url,
            jwt_secret,
            jwt_expiry_hours,
            server_addr,
            admin_registration_key,
            resend_api_key,
            email_from,
        })
    }
}
