-- Photos and inspection videos for supply listings (issue #32). The files
-- themselves live in the S3-compatible bucket (see src/storage.rs); this
-- table holds only their object keys and metadata.
--
-- Lifecycle: a row is created PENDING when the upload URL is issued, moves
-- to PROCESSING once the client confirms the upload and the object is
-- verified, then READY (derivatives generated) or FAILED (the file wasn't a
-- decodable image/video; its objects are deleted).
--
-- listing_id is NULL while a supplier uploads media before the listing
-- exists (the create-listing form); it's attached when the listing is
-- created with `mediaIds`.

CREATE TABLE listing_media (
    id                TEXT PRIMARY KEY,
    listing_id        TEXT REFERENCES supply_listings(id) ON DELETE CASCADE,
    uploader_id       TEXT NOT NULL REFERENCES users(id),
    kind              TEXT NOT NULL CHECK (kind IN ('image', 'video')),
    content_type      TEXT NOT NULL,
    size_bytes        BIGINT NOT NULL CHECK (size_bytes > 0),
    original_name     TEXT NOT NULL,
    storage_key       TEXT NOT NULL UNIQUE,
    -- Derivatives, set when processing succeeds: WebP renditions keyed by
    -- name ("small", "large") and, for videos, a WebP first-frame thumbnail.
    variants          JSONB NOT NULL DEFAULT '{}'::jsonb,
    thumbnail_key     TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    processing_error  TEXT,
    caption           TEXT,
    is_cover          BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_media_listing ON listing_media(listing_id, is_cover DESC, sort_order, created_at);
CREATE INDEX idx_listing_media_uploader_unattached ON listing_media(uploader_id) WHERE listing_id IS NULL;
-- At most one cover photo per listing.
CREATE UNIQUE INDEX uq_listing_media_cover ON listing_media(listing_id) WHERE is_cover;
