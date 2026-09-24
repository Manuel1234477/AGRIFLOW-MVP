# AgriFlow API — Test & Standards Audit

**Date:** 2026-09-23
**Scope:** Full functional pass against all 14 endpoints, plus an
adversarial/standards pass (SQL injection, XSS-shaped input, malformed auth,
oversized payloads, a 500-request ID-collision stress test, Content-Type
handling, CORS preflight).
**Method:** Tested locally against a fresh migrated database; also
spot-checked against the live Railway deployment.

---

## Result summary

**Functional: pass.** Auth, role gating, listing ownership, stock
validation, and — most importantly — the transaction state machine (illegal
transitions, wrong-actor transitions, terminal-state lockout, unknown status
strings) all behave exactly as coded, with correct HTTP status codes and
accurate error messages. SQL injection is **not exploitable** — parameterized
queries throughout; a `'; DROP TABLE users;--'` payload was stored as inert
text and the `users` table was confirmed intact afterward. Password hashing
is Argon2, correctly implemented.

The rest of this document is everything that is **not** standard and should
be treated as a punch list.

---

## Required changes (blocking)

### 1. Four endpoints require no authentication at all — ✅ FIXED (2026-09-24)
`GET /listings`, `GET /listings/{id}`, `GET /demands`, `GET /demands/{id}`.
Flagged as undesirable for this product. Fixed by adding the `auth:
AuthUser` extractor to all four handlers — any authenticated role (buyer,
supplier, logistics, admin) can now browse, but an anonymous caller gets
`401 Missing Authorization header.`. No role restriction beyond "must be
logged in," since both buyers and suppliers legitimately need to browse
both listings and demands. Verified: unauthenticated requests to all four
routes now 401; authenticated requests (any role) succeed unchanged.
See the updated API surface table in `README.md`.

A resource-key-based gate (a secret issued by the backend, separate from
user login) was considered and deliberately rejected in favor of this
simpler fix — see discussion history for the reasoning: a statically
embedded key in a public SPA build is trivially extractable from the
browser bundle regardless of expiry, and a dynamically-issued key with no
credential check on issuance doesn't stop scripted abuse either. User-role
gating was judged sufficient for now.

### 2. Decimal fields serialize as JSON strings, not numbers — ✅ FIXED (2026-09-24)
`quantity`, `pricePerUnit`, `totalAmount`, and `indicativeBudget` all came
back as `"20"` instead of `20` (a `rust_decimal::Decimal` default). Fixed
by enabling the `serde-with-float` feature on `rust_decimal` and annotating
every response-facing `Decimal` field (`SupplyListing`, `DemandRequest`,
`Transaction`) with `#[serde(with = "rust_decimal::serde::float")]`. Only
the *response* side was changed — request DTOs (`CreateListingRequest`,
`CreateDemandRequest`, `CreateTransactionRequest`, `UpdateListingRequest`)
were left on the default (flexible) `Decimal` deserializer, since they
already accepted numbers correctly and nothing needed fixing there.
Verified: `GET /listings`, `/demands`, `/transactions` now return unquoted
JSON numbers; `POST /listings` still accepts and round-trips correctly.
The frontend's `apiMappers.ts` coercion (`num()`) is unaffected — it
already tolerates receiving real numbers instead of strings.

### 3. The trade lifecycle dead-ends at `PAYMENT_PENDING` — ✅ FIXED, then partly regressed, now re-fixed (2026-09-24)
Originally: `PAYMENT_CONFIRMED` only accepted the `system` actor, and no
endpoint could authenticate as `system`, so no client could move a
transaction past payment-pending. Fixed by an earlier commit
(`mock_confirm_payment`/`mock_fail_payment`, buyer-scoped endpoints acting
as `Actor::System` internally) — but that fix was undone by a later commit
that loosened `PaymentConfirmed`/`PaymentFailed`/`PaymentCancelled`/
`LogisticsPending` in `state_machine.rs` to allow `Buyer` directly. That
meant **any buyer could self-confirm their own payment** via
`POST /transactions/:id/transition {"to":"PAYMENT_CONFIRMED"}` — a live,
provable exploit (verified: the exact call succeeded with `200` before this
fix), since the backend never checked that money actually moved.

Re-fixed by:
- Restoring `PaymentConfirmed`/`PaymentFailed`/`LogisticsPending` to
  `System`-only and `PaymentCancelled` to `Buyer`-only, with a doc comment
  and two new regression tests (`buyer_cannot_self_confirm_or_fail_payment`,
  `buyer_cannot_self_drive_logistics_pending`) so this can't silently
  regress a third time.
- Adding a real `payments` table (migration `0002_payments.sql`) — payments
  were never persisted anywhere before this, only inferred from transaction
  status.
- A proper three-endpoint payment flow: `POST .../payment/initiate` (buyer,
  idempotent, creates a `PENDING` row), `POST .../payment/confirm` (buyer,
  settles it — amount/currency come only from the row `initiate` created,
  never from the confirm request body, so a buyer can't "confirm" a lower
  amount than they owed), `POST .../payment/fail`, `GET .../payment`.
- A `stellar_tx_hash` column, so the Soroban escrow flow's on-chain
  transaction hash has somewhere durable to live instead of only existing
  in React state until the next page refresh.

Verified: the self-confirm exploit now returns `409 A buyer cannot perform
this action`; the full initiate → confirm (with a Stellar hash) → read
flow persists correctly; a second buyer/supplier cannot touch another
buyer's payment (`403`); confirming an already-settled payment twice is a
clean idempotent `200`, not a `409` (a pre-existing bug surfaced by this
work, fixed alongside it). `cargo test` passes (10 tests, 4 new).

### 4. Entity ID generation has an unhandled collision window — ✅ FIXED (2026-09-24)
`src/ids.rs::generate()` draws a random 5-digit suffix (`10_000..99_999`,
~90,000 values) with no collision check or retry, and that value is the
literal `TEXT PRIMARY KEY` for users, listings, demands, and transactions.
By the birthday paradox, ~375 inserts of one entity type give roughly 50%
odds of a collision, which would surface as a raw, unhandled `500 A
database error occurred.`

Fixed with a retry loop (not a switch to UUIDs — `README.md` explicitly
documents the human-readable id format as intentional, and a retry loop
preserves it without that larger, more disruptive change). Added
`ids::MAX_ID_ATTEMPTS` (5) and `ids::is_id_collision(&sqlx::Error)`, which
checks specifically for a Postgres unique-violation on a table's
auto-generated `<table>_pkey` constraint (as opposed to, say,
`users_email_key`, which no amount of retrying with a new id would ever
resolve). All four id-assigning inserts (`auth::register`,
`listings::create`, `demands::create`, `transactions::create`) now loop:
generate an id, attempt the insert, regenerate and retry on a PK collision,
propagate any other error immediately, and return a clean `500` (logged
server-side with detail, generic message to the client) if genuinely
exhausted after 5 attempts. `transactions::create`'s case is the trickiest,
since it holds an open DB transaction across two inserts (the transaction
row, then its first history event) -- a collision there drops the whole
`tx` (Postgres aborts a transaction after any failed statement in it, so
partial retry isn't possible) and starts a fresh one for the next attempt.

Verified empirically, not just by inspection: temporarily shrank the id
space to 3 possible values, then created listings against it. The first
three succeeded with three distinct ids (proving the retry loop actually
regenerates on collision), and a fourth attempt -- genuinely impossible,
no free ids left -- failed cleanly with `500 An internal error occurred.`
instead of hanging, crashing, or silently creating a duplicate; the server
log correctly recorded `failed to generate a unique listing id after 5
attempts` without leaking that detail to the client. Restored the real id
space afterward and re-ran an end-to-end check across all four entity
types. `cargo test` passes.

### 5. Input validation is inconsistent between near-identical fields — ✅ FIXED (2026-09-24)
- `pricePerUnit` on listings rejected negative values; `indicativeBudget` on
  demands did **not** — `-999999` was accepted with `200 OK`.
- Empty strings were accepted for `commodity`, `unit`, `qualityGrade`, and
  `location`/`destinationLocation` on both listings and demands (a listing
  with `commodity: ""` was created successfully).
- Email format was not validated on register — `"not-an-email"` was
  accepted as a valid email.

Fixed with a new shared `src/validation.rs` module (`require_non_empty`,
`is_valid_email`) instead of each handler inventing its own version of the
check:
- `demands::create` now rejects a negative `indicativeBudget`, matching
  `listings::create`'s existing `pricePerUnit` check.
- Both `listings::create` and `demands::create` now reject blank
  `commodity`, `unit`, `qualityGrade`, and `location`/`destinationLocation`.
- `auth::register` now rejects an email without an `@`, a non-empty local
  part, and a domain containing a `.` (deliberately permissive — not full
  RFC 5322 validation, just enough to catch obviously-invalid input).

Verified: all four previously-accepted invalid inputs now return `400`
with a clear message; valid listings, demands, and registrations are
unaffected. Two new unit tests for `is_valid_email` plus the existing
suite all pass (`cargo test`, 8 tests).

### 6. Error response shape is inconsistent
Hand-written `AppError` responses return `{"error": "..."}` with correct
status codes. Axum's built-in request-rejection paths do not go through
`AppError` and return **plain text** instead of JSON:
- Malformed JSON body → `400`, plain text
- Invalid enum variant (e.g. bad `role` or `status` value) → `422`, plain
  text
- Missing/wrong `Content-Type` header → `415`, plain text ("Expected
  request with `Content-Type: application/json`")

Any frontend expecting a uniform `{error: string}` envelope will mishandle
these specific cases. Fix: add a custom JSON-rejection handler (or a
`FromRequest` wrapper around `Json<T>`) so every error path returns the
same shape.

---

## Recommended (not blocking, but standard practice before production)

| # | Finding | Why it matters |
|---|---|---|
| 1 | `CorsLayer::permissive()` allows any origin/method/header | Fine for local dev; must be locked to the real frontend origin(s) before any public deployment |
| 2 | No rate limiting on `/auth/login` or `/auth/register` | Unbounded brute-force / credential-stuffing surface |
| 3 | Password minimum is 6 characters | Below common baseline (8+); consider raising and/or adding complexity or breach-list checks |
| 4 | No `/health` endpoint | Most PaaS/orchestration platforms (including Railway) expect one for readiness checks |
| 5 | No pagination on `/listings`, `/demands`, `/transactions` | Fine at current scale; will need `limit`/`offset` or cursor pagination before real usage |
| 6 | No max length enforced on text fields | A 10,000-character `commodity` string was accepted without complaint |
| 7 | JWT is stateless with no revocation | Normal for JWT, but means there's no real "logout" — a leaked token stays valid until it expires (24h) |
| 8 | No API version prefix (`/api/v1/...`) | Not urgent pre-launch, but retrofitting versioning after clients exist is painful |

---

## Confirmed solid (no action needed)

Argon2 password hashing, parameterized queries (no SQL injection surface
anywhere tested), the transaction state machine's transition/actor
enforcement (the most-tested and most-correct part of the system), CORS
preflight handling, and consistent camelCase field naming matching the
frontend's type definitions apart from item 2 above.
