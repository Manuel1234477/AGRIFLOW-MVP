use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::ids;
use crate::media;
use crate::models::listing::{
    CreateListingRequest, ListingStatus, ListingWithMedia, SupplyListing, UpdateListingRequest,
};
use crate::models::user::UserRole;
use crate::state::AppState;
use crate::validation::require_non_empty;

/// Attaches each listing's media (one query for the whole page).
async fn with_media(state: &AppState, listings: Vec<SupplyListing>) -> AppResult<Vec<ListingWithMedia>> {
    let ids: Vec<String> = listings.iter().map(|l| l.id.clone()).collect();
    let mut media = media::for_listings(&state.db, &ids).await?;
    Ok(listings
        .into_iter()
        .map(|listing| ListingWithMedia { media: media.remove(&listing.id).unwrap_or_default(), listing })
        .collect())
}

async fn one_with_media(state: &AppState, listing: SupplyListing) -> AppResult<Json<ListingWithMedia>> {
    let mut all = with_media(state, vec![listing]).await?;
    Ok(Json(all.remove(0)))
}

#[derive(Debug, Deserialize)]
pub struct ListingQuery {
    pub commodity: Option<String>,
    pub status: Option<String>,
}

pub async fn list_active(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListingQuery>,
) -> AppResult<Json<Vec<ListingWithMedia>>> {
    let status = q.status.unwrap_or_else(|| "active".to_string());
    let listings = sqlx::query_as!(
        SupplyListing,
        r#"
        SELECT id, supplier_id, supplier_name, supplier_verified, commodity, quantity,
               unit, quality_grade, price_per_unit, currency, location, availability_date,
               description, status as "status: _", created_at, updated_at
        FROM supply_listings
        WHERE status = $1 AND ($2::text IS NULL OR commodity = $2)
        ORDER BY created_at DESC
        "#,
        status,
        q.commodity,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(with_media(&state, listings).await?))
}

pub async fn mine(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<ListingWithMedia>>> {
    auth.require_role(UserRole::Supplier)?;

    let listings = sqlx::query_as!(
        SupplyListing,
        r#"
        SELECT id, supplier_id, supplier_name, supplier_verified, commodity, quantity,
               unit, quality_grade, price_per_unit, currency, location, availability_date,
               description, status as "status: _", created_at, updated_at
        FROM supply_listings
        WHERE supplier_id = $1
        ORDER BY created_at DESC
        "#,
        auth.user_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(with_media(&state, listings).await?))
}

pub async fn get_one(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<ListingWithMedia>> {
    let listing = sqlx::query_as!(
        SupplyListing,
        r#"
        SELECT id, supplier_id, supplier_name, supplier_verified, commodity, quantity,
               unit, quality_grade, price_per_unit, currency, location, availability_date,
               description, status as "status: _", created_at, updated_at
        FROM supply_listings WHERE id = $1
        "#,
        id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Listing not found.".into()))?;

    one_with_media(&state, listing).await
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateListingRequest>,
) -> AppResult<Json<ListingWithMedia>> {
    auth.require_role(UserRole::Supplier)?;

    require_non_empty("commodity", &body.commodity)?;
    require_non_empty("unit", &body.unit)?;
    require_non_empty("qualityGrade", &body.quality_grade)?;
    require_non_empty("location", &body.location)?;

    if body.quantity <= rust_decimal::Decimal::ZERO {
        return Err(AppError::BadRequest("Quantity must be greater than zero.".into()));
    }
    if body.price_per_unit < rust_decimal::Decimal::ZERO {
        return Err(AppError::BadRequest("Price cannot be negative.".into()));
    }

    let mut seen = std::collections::HashSet::new();
    let media_ids: Vec<String> = body.media_ids.into_iter().filter(|id| seen.insert(id.clone())).collect();
    if media_ids.len() as i64 > media::MAX_MEDIA_PER_LISTING {
        return Err(AppError::BadRequest(format!(
            "A listing can have at most {} photos and videos.",
            media::MAX_MEDIA_PER_LISTING
        )));
    }
    if !media_ids.is_empty() {
        let usable = sqlx::query_scalar!(
            r#"SELECT count(*) as "count!" FROM listing_media
               WHERE id = ANY($1) AND uploader_id = $2 AND listing_id IS NULL
                 AND status IN ('processing', 'ready')"#,
            &media_ids,
            auth.user_id,
        )
        .fetch_one(&state.db)
        .await?;
        if usable != media_ids.len() as i64 {
            return Err(AppError::BadRequest(
                "Some mediaIds are unknown, not yours, already attached, failed, or not finished uploading.".into(),
            ));
        }
    }

    let currency = body.currency.unwrap_or_else(|| "NGN".to_string());
    let description = body.description.unwrap_or_default();

    let mut listing = None;
    for _ in 0..ids::MAX_ID_ATTEMPTS {
        let id = ids::generate("SUP");
        match sqlx::query_as!(
            SupplyListing,
            r#"
            INSERT INTO supply_listings
                (id, supplier_id, supplier_name, supplier_verified, commodity, quantity, unit,
                 quality_grade, price_per_unit, currency, location, availability_date, description, status)
            VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
            RETURNING id, supplier_id, supplier_name, supplier_verified, commodity, quantity,
                      unit, quality_grade, price_per_unit, currency, location, availability_date,
                      description, status as "status: _", created_at, updated_at
            "#,
            id,
            auth.user_id,
            auth.name,
            body.commodity,
            body.quantity,
            body.unit,
            body.quality_grade,
            body.price_per_unit,
            currency,
            body.location,
            body.availability_date,
            description,
        )
        .fetch_one(&state.db)
        .await
        {
            Ok(l) => {
                listing = Some(l);
                break;
            }
            Err(e) if ids::is_id_collision(&e) => continue,
            Err(e) => return Err(e.into()),
        }
    }
    let listing = listing.ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!(
            "failed to generate a unique listing id after {} attempts",
            ids::MAX_ID_ATTEMPTS
        ))
    })?;

    if !media_ids.is_empty() {
        // Order follows `mediaIds`; the first photo becomes the cover.
        sqlx::query!(
            r#"UPDATE listing_media m SET listing_id = $1, sort_order = u.ord - 1, updated_at = now()
               FROM unnest($2::text[]) WITH ORDINALITY AS u(id, ord)
               WHERE m.id = u.id AND m.uploader_id = $3 AND m.listing_id IS NULL"#,
            listing.id,
            &media_ids,
            auth.user_id,
        )
        .execute(&state.db)
        .await?;
        sqlx::query!(
            r#"UPDATE listing_media SET is_cover = TRUE
               WHERE id = (SELECT id FROM listing_media WHERE listing_id = $1 AND kind = 'image'
                           ORDER BY sort_order LIMIT 1)"#,
            listing.id,
        )
        .execute(&state.db)
        .await?;
    }

    one_with_media(&state, listing).await
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateListingRequest>,
) -> AppResult<Json<ListingWithMedia>> {
    auth.require_role(UserRole::Supplier)?;

    let existing = sqlx::query_scalar!("SELECT supplier_id FROM supply_listings WHERE id = $1", id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Listing not found.".into()))?;

    if existing != auth.user_id {
        return Err(AppError::Forbidden("You do not own this listing.".into()));
    }

    let status: Option<ListingStatus> = body.status;

    let listing = sqlx::query_as!(
        SupplyListing,
        r#"
        UPDATE supply_listings SET
            quantity = COALESCE($2, quantity),
            price_per_unit = COALESCE($3, price_per_unit),
            description = COALESCE($4, description),
            status = COALESCE($5, status),
            updated_at = now()
        WHERE id = $1
        RETURNING id, supplier_id, supplier_name, supplier_verified, commodity, quantity,
                  unit, quality_grade, price_per_unit, currency, location, availability_date,
                  description, status as "status: _", created_at, updated_at
        "#,
        id,
        body.quantity,
        body.price_per_unit,
        body.description,
        status as _,
    )
    .fetch_one(&state.db)
    .await?;

    one_with_media(&state, listing).await
}
