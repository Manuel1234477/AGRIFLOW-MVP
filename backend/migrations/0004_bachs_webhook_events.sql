-- Every Bachs webhook delivery we accepted (signature verified), keyed by
-- the provider's event id. Bachs guarantees at-least-once delivery, so the
-- primary key is what makes redelivery of an already-processed event a
-- no-op. The row is written in the same database transaction as the
-- payment/transaction updates the event triggers, so a failed handler
-- leaves no row behind and the retry is processed normally.

CREATE TABLE bachs_webhook_events (
    event_id     TEXT PRIMARY KEY,
    event_type   TEXT NOT NULL,
    payment_id   TEXT REFERENCES payments(id),
    payload      JSONB NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bachs_webhook_events_payment ON bachs_webhook_events(payment_id);
