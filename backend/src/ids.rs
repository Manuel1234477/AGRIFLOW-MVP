use rand::RngExt;

/// Generates IDs in the same human-readable shape the frontend already uses
/// (e.g. `USR-BUY-4f9a2c`, `TXN-AGF-83021`) so existing seed/demo data and
/// any code that pattern-matches on ID prefixes keeps working.
pub fn generate(prefix: &str) -> String {
    let suffix: u32 = rand::rng().random_range(10_000..99_999);
    format!("{prefix}-{suffix}")
}

/// The random suffix is only ~90,000 values wide, so a collision is a real
/// (if rare) possibility on a table with enough rows -- see API_AUDIT.md R4.
/// Every INSERT that assigns a fresh id retries up to this many times,
/// regenerating the id on a primary-key collision, rather than switching the
/// whole codebase to UUIDs and losing the human-readable ids README.md calls
/// out as intentional.
pub const MAX_ID_ATTEMPTS: u8 = 5;

/// True if `err` is a Postgres unique-violation specifically on a table's
/// primary key (its auto-generated `<table>_pkey` constraint) -- as opposed
/// to, say, `users_email_key`, which no amount of retrying with a new id
/// would ever resolve.
pub fn is_id_collision(err: &sqlx::Error) -> bool {
    let Some(db_err) = err.as_database_error() else { return false };
    db_err.is_unique_violation() && db_err.constraint().is_some_and(|c| c.ends_with("_pkey"))
}

pub fn user_id(role: &str) -> String {
    let prefix = match role {
        "buyer" => "USR-BUY",
        "supplier" => "USR-SUP",
        "logistics" => "USR-LOG",
        _ => "USR-ADM",
    };
    generate(prefix)
}

/// A synthetic settlement reference for the mock escrow provider, in the
/// same shape the original frontend-only implementation used.
pub fn provider_reference() -> String {
    let date = chrono::Utc::now().format("%Y%m%d");
    let rand: u32 = rand::rng().random_range(100_000..900_000);
    format!("AF-PAY-{date}-{rand}")
}
