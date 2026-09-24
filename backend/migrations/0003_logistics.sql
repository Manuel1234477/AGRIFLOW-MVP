-- Persists logistics job dispatch/tracking, previously tracked only in the
-- frontend's localStorage (src/services/logisticsService.ts). One job per
-- transaction (auto-created once payment is confirmed), claimed or assigned
-- to a logistics-role provider, then driven through pickup/transit/delivery
-- by that provider.
--
-- Status list and proof_of_delivery shape are ported 1:1 from
-- src/types/index.ts's LogisticsStatus/ProofOfDelivery -- issue #37's own
-- schema sketch only lists 7 of the 10 real status values (missing
-- REJECTED, READY_FOR_PICKUP, FAILED) and flattens proof of delivery into
-- two text columns instead of the real 4-field object, so this
-- deliberately doesn't match that sketch exactly.

CREATE TABLE logistics_jobs (
    id                       TEXT PRIMARY KEY,
    transaction_id           TEXT NOT NULL UNIQUE REFERENCES transactions(id),
    provider_id              TEXT REFERENCES users(id),
    provider_name            TEXT,
    commodity                TEXT NOT NULL,
    quantity                 NUMERIC NOT NULL CHECK (quantity > 0),
    unit                     TEXT NOT NULL,
    pickup_location          TEXT NOT NULL,
    delivery_location        TEXT NOT NULL,
    pickup_date               TIMESTAMPTZ NOT NULL,
    expected_delivery_date    TIMESTAMPTZ NOT NULL,
    logistics_cost             NUMERIC NOT NULL CHECK (logistics_cost >= 0),
    currency                    TEXT NOT NULL DEFAULT 'NGN',
    status                      TEXT NOT NULL DEFAULT 'PENDING'
                                   CHECK (status IN (
                                       'PENDING', 'ASSIGNED', 'ACCEPTED', 'REJECTED',
                                       'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT',
                                       'DELIVERED', 'COMPLETED', 'FAILED'
                                   )),
    proof_of_delivery           JSONB,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_logistics_jobs_provider ON logistics_jobs(provider_id);
CREATE INDEX idx_logistics_jobs_status ON logistics_jobs(status);
