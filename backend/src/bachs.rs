//! Bachs.io hosted checkout (https://docs.bachs.io/guides/checkout/checkout-sessions)
//! and webhook signature verification
//! (https://docs.bachs.io/guides/webhooks/overview#verifying-your-webhooks).
//!
//! The API key only ever lives here, server-side -- the browser gets back
//! nothing but the hosted checkout URL. Settlement is driven exclusively by
//! the signed `collection.*` webhooks (see `routes::webhooks`), never by the
//! checkout redirect, which the buyer controls.

use axum::http::HeaderMap;
use hmac::{Hmac, Mac};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::json;
use sha2::Sha256;

/// Value stored in `payments.provider` for payments settled through Bachs.
/// `mock_confirm_payment`/`mock_fail_payment` refuse to touch these.
pub const PROVIDER: &str = "Bachs.io";

const SANDBOX_API: &str = "https://sandbox-api.bachs.io";
const LIVE_API: &str = "https://api.bachs.io";

/// How far a delivery's `X-Bachs-Timestamp` may drift from now before it is
/// treated as a replay -- the 5 minutes Bachs' own examples use.
const SIGNATURE_TOLERANCE_SECS: i64 = 300;

pub struct CheckoutRequest<'a> {
    pub amount: Decimal,
    pub currency: &'a str,
    pub customer_email: &'a str,
    pub customer_name: &'a str,
    pub success_url: Option<&'a str>,
    pub cancel_url: Option<&'a str>,
    pub transaction_id: &'a str,
    pub payment_id: &'a str,
}

#[derive(Debug, Deserialize)]
pub struct CheckoutSession {
    pub checkout_id: String,
    pub checkout_url: String,
}

/// `sk_sandbox_` keys only work against the sandbox host; anything else is
/// treated as a live key. Going live is a key swap, per the Bachs docs.
fn api_base(secret_key: &str) -> &'static str {
    if secret_key.starts_with("sk_sandbox_") {
        SANDBOX_API
    } else {
        LIVE_API
    }
}

/// Creates a hosted checkout priced as a raw amount (no Bachs catalog
/// product). Money goes over the wire as a decimal string at currency
/// precision, never minor units.
pub async fn create_checkout_session(
    client: &reqwest::Client,
    secret_key: &str,
    req: CheckoutRequest<'_>,
) -> anyhow::Result<CheckoutSession> {
    let mut body = json!({
        "pricing": {
            "amount": format!("{:.2}", req.amount.round_dp(2)),
            "currency": req.currency,
        },
        "customer": { "email": req.customer_email, "name": req.customer_name },
        // Echoed back in the collection.* webhooks' `data.metadata`, which is
        // how the webhook finds the payment row it settles.
        "metadata": {
            "transaction_id": req.transaction_id,
            "payment_id": req.payment_id,
            "platform": "AgriFlow",
            "escrow": "true",
        },
    });
    if let Some(url) = req.success_url {
        body["success_url"] = json!(url);
    }
    if let Some(url) = req.cancel_url {
        body["cancel_url"] = json!(url);
    }

    let res = client
        .post(format!("{}/v1/checkout-sessions", api_base(secret_key)))
        .bearer_auth(secret_key)
        .json(&body)
        .send()
        .await?;

    let status = res.status();
    if !status.is_success() {
        let detail = res.text().await.unwrap_or_default();
        anyhow::bail!("Bachs rejected checkout session ({status}): {detail}");
    }
    Ok(res.json().await?)
}

/// Checks a webhook delivery against every signing secret-derived digest it
/// carries. Prefers `X-Bachs-Signature-V2` (`t=...,v1=...[,v1=...]`, one
/// `v1` per valid secret during a rotation) and falls back to the legacy
/// `X-Bachs-Timestamp` + `X-Bachs-Signature` pair. `raw_body` must be the
/// exact bytes received -- re-serialized JSON will not match.
pub fn verify_signature(secret: &str, headers: &HeaderMap, raw_body: &[u8], now_unix: i64) -> bool {
    let header = |name| headers.get(name).and_then(|v| v.to_str().ok());

    let (timestamp, signatures): (&str, Vec<&str>) = if let Some(v2) = header("x-bachs-signature-v2") {
        let mut timestamp = None;
        let mut signatures = Vec::new();
        for part in v2.split(',') {
            match part.trim().split_once('=') {
                Some(("t", t)) => timestamp = Some(t),
                Some(("v1", sig)) => signatures.push(sig),
                _ => {}
            }
        }
        match timestamp {
            Some(t) => (t, signatures),
            None => return false,
        }
    } else {
        match (header("x-bachs-timestamp"), header("x-bachs-signature")) {
            (Some(t), Some(sig)) => (t, vec![sig]),
            _ => return false,
        }
    };

    let Ok(ts) = timestamp.parse::<i64>() else {
        return false;
    };
    if (now_unix - ts).abs() > SIGNATURE_TOLERANCE_SECS {
        return false;
    }

    signatures.iter().any(|sig| {
        let Ok(expected) = hex::decode(sig) else {
            return false;
        };
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
            .expect("HMAC accepts keys of any length");
        mac.update(timestamp.as_bytes());
        mac.update(b".");
        mac.update(raw_body);
        // verify_slice is constant-time.
        mac.verify_slice(&expected).is_ok()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    const SECRET: &str = "whsec_test";
    const BODY: &[u8] = br#"{"id":"evt_1","type":"collection.succeeded","data":{}}"#;
    const NOW: i64 = 1_790_000_000;

    fn sign(secret: &str, ts: i64, body: &[u8]) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(format!("{ts}.").as_bytes());
        mac.update(body);
        hex::encode(mac.finalize().into_bytes())
    }

    fn headers(pairs: &[(&'static str, String)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(*k, HeaderValue::from_str(v).unwrap());
        }
        h
    }

    #[test]
    fn accepts_valid_legacy_signature() {
        let h = headers(&[
            ("x-bachs-timestamp", NOW.to_string()),
            ("x-bachs-signature", sign(SECRET, NOW, BODY)),
        ]);
        assert!(verify_signature(SECRET, &h, BODY, NOW));
    }

    #[test]
    fn accepts_v2_when_any_v1_matches() {
        let v2 = format!("t={NOW},v1={},v1={}", sign("whsec_old", NOW, BODY), sign(SECRET, NOW, BODY));
        let h = headers(&[("x-bachs-signature-v2", v2)]);
        assert!(verify_signature(SECRET, &h, BODY, NOW));
    }

    #[test]
    fn rejects_wrong_secret_tampered_body_and_missing_headers() {
        let h = headers(&[
            ("x-bachs-timestamp", NOW.to_string()),
            ("x-bachs-signature", sign("whsec_other", NOW, BODY)),
        ]);
        assert!(!verify_signature(SECRET, &h, BODY, NOW));

        let h = headers(&[
            ("x-bachs-timestamp", NOW.to_string()),
            ("x-bachs-signature", sign(SECRET, NOW, BODY)),
        ]);
        assert!(!verify_signature(SECRET, &h, b"{}", NOW));

        assert!(!verify_signature(SECRET, &HeaderMap::new(), BODY, NOW));
    }

    #[test]
    fn rejects_stale_timestamp() {
        let old = NOW - SIGNATURE_TOLERANCE_SECS - 1;
        let h = headers(&[("x-bachs-signature-v2", format!("t={old},v1={}", sign(SECRET, old, BODY)))]);
        assert!(!verify_signature(SECRET, &h, BODY, NOW));
    }

    #[test]
    fn picks_api_host_from_key_prefix() {
        assert_eq!(api_base("sk_sandbox_abc"), SANDBOX_API);
        assert_eq!(api_base("sk_live_abc"), LIVE_API);
    }
}
