//! Seeds the default platform administrator account (issue #33):
//! `admin@agriflow.africa` / "AgriFlow System Administrator". Idempotent --
//! re-running updates the password rather than erroring on the existing
//! email.
//!
//! `cargo run --bin seed_admin`, with `ADMIN_SEED_PASSWORD` set. There's no
//! hardcoded default password here on purpose -- unlike the Bachs sandbox
//! keys elsewhere in this codebase, a production admin credential isn't
//! something to bake into source.
//!
//! Kept as its own binary crate (same pattern as `migrate.rs`), so the
//! password hashing is duplicated from `auth::password::hash_password`
//! rather than imported -- this crate has no `[lib]` target for `src/bin/*`
//! to share `crate::` modules with `main.rs`.

use argon2::{Argon2, password_hash::PasswordHasher};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")?;
    let password = std::env::var("ADMIN_SEED_PASSWORD")
        .map_err(|_| anyhow::anyhow!("ADMIN_SEED_PASSWORD must be set to seed the admin account"))?;
    if password.len() < 6 {
        anyhow::bail!("ADMIN_SEED_PASSWORD must be at least 6 characters");
    }

    let password_hash = Argon2::default()
        .hash_password(password.as_bytes())
        .map_err(|e| anyhow::anyhow!("password hashing failed: {e}"))?
        .to_string();

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    sqlx::query!(
        r#"
        INSERT INTO users (id, email, password_hash, name, role, verified, profile_complete)
        VALUES ('USR-ADM-00001', 'admin@agriflow.africa', $1, 'AgriFlow System Administrator', 'admin', TRUE, TRUE)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()
        "#,
        password_hash,
    )
    .execute(&pool)
    .await?;

    println!("Seeded admin account: admin@agriflow.africa");
    Ok(())
}
