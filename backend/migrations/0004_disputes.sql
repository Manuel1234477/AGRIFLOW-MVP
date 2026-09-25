-- Persists transaction disputes, previously tracked only in the frontend's
-- localStorage (src/services/disputeService.ts). Status list ported 1:1
-- from src/types/index.ts's DisputeStatus -- includes CLOSED even though
-- neither the frontend's resolve() nor this migration's initial endpoints
-- ever set it, for the same reason logistics_jobs' FAILED status was kept:
-- fidelity to the real type, not the subset one code path happens to use.

CREATE TABLE disputes (
    id                TEXT PRIMARY KEY,
    transaction_id    TEXT NOT NULL REFERENCES transactions(id),
    raised_by_id      TEXT NOT NULL REFERENCES users(id),
    raised_by_name    TEXT NOT NULL,
    reason            TEXT NOT NULL,
    description       TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED')),
    resolution        TEXT,
    resolved_by_id    TEXT REFERENCES users(id),
    resolved_by_name  TEXT,
    resolved_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disputes_transaction ON disputes(transaction_id);
CREATE INDEX idx_disputes_status ON disputes(status);
