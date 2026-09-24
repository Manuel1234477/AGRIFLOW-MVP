-- Persists escrow payment records, previously tracked only in the
-- frontend's localStorage. See the payments punch list: payment settlement
-- must be server-verified (mock_confirm_payment / mock_fail_payment), not
-- self-reported by the payer, and every settlement needs a durable record.

CREATE TABLE payments (
    id                   TEXT PRIMARY KEY,
    transaction_id       TEXT NOT NULL REFERENCES transactions(id),
    payer_id             TEXT NOT NULL REFERENCES users(id),
    amount               NUMERIC NOT NULL CHECK (amount >= 0),
    currency             TEXT NOT NULL DEFAULT 'NGN',
    provider             TEXT NOT NULL DEFAULT 'AgriFlow Escrow Service',
    provider_reference   TEXT,
    -- Populated for the Stellar/Soroban payment path -- the on-chain
    -- transaction hash proving an escrow deposit actually happened, so it
    -- survives longer than the browser tab it was shown in.
    stellar_tx_hash      TEXT,
    status               TEXT NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'REFUNDED')),
    failure_reason       TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at         TIMESTAMPTZ
);

CREATE INDEX idx_payments_transaction ON payments(transaction_id);
CREATE INDEX idx_payments_payer ON payments(payer_id);
