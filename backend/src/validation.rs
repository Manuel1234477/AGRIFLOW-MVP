//! Small, shared input-validation helpers. Exists so the same rule (a field
//! must not be blank, an email must look like an email) is enforced the same
//! way everywhere it's needed, rather than each handler inventing its own
//! version of the check (see API_AUDIT.md R5 -- that inconsistency is what
//! this module fixes).

use crate::error::{AppError, AppResult};

pub fn require_non_empty(field: &str, value: &str) -> AppResult<()> {
    if value.trim().is_empty() {
        return Err(AppError::BadRequest(format!("{field} is required.")));
    }
    Ok(())
}

/// Deliberately permissive -- not RFC 5322 validation, just enough to reject
/// obviously-not-an-email input like `"not-an-email"`: exactly one `@`, a
/// non-empty local part, and a domain part containing at least one `.` with
/// non-empty labels on both sides of it.
pub fn is_valid_email(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else { return false };
    if local.is_empty() || domain.is_empty() || domain.contains('@') {
        return false;
    }
    let Some((label, tld)) = domain.rsplit_once('.') else { return false };
    !label.is_empty() && !tld.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_ordinary_emails() {
        assert!(is_valid_email("buyer@kolafarms.com"));
        assert!(is_valid_email("a.b+c@sub.example.co"));
    }

    #[test]
    fn rejects_obviously_invalid_input() {
        assert!(!is_valid_email("not-an-email"));
        assert!(!is_valid_email("missing-domain@"));
        assert!(!is_valid_email("@missing-local.com"));
        assert!(!is_valid_email("two@at@signs.com"));
        assert!(!is_valid_email("no-dot@localhost"));
    }
}
