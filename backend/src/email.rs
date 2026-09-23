//! Transactional email via Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
//!
//! Sends are fire-and-forget: they run on a spawned task so a slow or failing
//! email provider never delays or fails the request that triggered it —
//! failures are logged, not returned. With no `RESEND_API_KEY` configured
//! (local dev, tests) every send is skipped with a log line.

use serde_json::json;

use crate::models::user::UserRole;

const RESEND_URL: &str = "https://api.resend.com/emails";

#[derive(Clone)]
pub struct Mailer {
    client: reqwest::Client,
    api_key: Option<String>,
    from: String,
}

impl Mailer {
    pub fn new(api_key: Option<String>, from: String) -> Self {
        if api_key.is_none() {
            tracing::warn!("RESEND_API_KEY is not set — outgoing email is disabled");
        }
        Self {
            client: reqwest::Client::new(),
            api_key,
            from,
        }
    }

    /// Queues the welcome email for a newly registered user.
    pub fn send_welcome(&self, to: &str, name: &str, role: UserRole) {
        let name = escape_html(name);
        let role_line = match role {
            UserRole::Buyer => "post procurement demands and buy from verified suppliers",
            UserRole::Supplier => "list your produce and receive orders from buyers",
            UserRole::Logistics => "pick up haulage jobs and update deliveries",
            UserRole::Admin => "oversee transactions, logistics and disputes",
        };
        let html = format!(
            "<p>Hi {name},</p>\
             <p>Welcome to AgriFlow! Your {role} account is ready — you can now {role_line}.</p>\
             <p>Payments on AgriFlow are held in escrow and only released once delivery is confirmed.</p>\
             <p>— The AgriFlow team</p>"
        );
        self.send(to, "Welcome to AgriFlow", html);
    }

    fn send(&self, to: &str, subject: &str, html: String) {
        let Some(api_key) = self.api_key.clone() else {
            tracing::info!(to, subject, "email disabled; skipping send");
            return;
        };
        let client = self.client.clone();
        let body = json!({ "from": self.from, "to": [to], "subject": subject, "html": html });
        let to = to.to_owned();
        let subject = subject.to_owned();

        tokio::spawn(async move {
            let result = client
                .post(RESEND_URL)
                .bearer_auth(api_key)
                .json(&body)
                .send()
                .await;
            match result {
                Ok(res) if res.status().is_success() => {
                    tracing::info!(to, subject, "email sent");
                }
                Ok(res) => {
                    let status = res.status();
                    let detail = res.text().await.unwrap_or_default();
                    tracing::error!(to, subject, %status, detail, "email provider rejected send");
                }
                Err(e) => tracing::error!(to, subject, error = %e, "email send failed"),
            }
        });
    }
}

/// User-supplied values (e.g. the account name) are interpolated into the
/// email body, so they must not be able to inject markup.
fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::escape_html;

    #[test]
    fn escapes_markup_in_user_values() {
        assert_eq!(
            escape_html(r#"<a href="x">O'Neil & Co</a>"#),
            "&lt;a href=&quot;x&quot;&gt;O&#39;Neil &amp; Co&lt;/a&gt;"
        );
    }
}
