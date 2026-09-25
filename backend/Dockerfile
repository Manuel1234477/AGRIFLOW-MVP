# syntax=docker/dockerfile:1

FROM rust:1.98-slim-bookworm AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Cache dependency compilation separately from app code.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN mkdir -p src/bin && echo "fn main() {}" > src/bin/migrate.rs
RUN cargo build --release && rm -rf src

COPY . .
# SQLX_OFFLINE uses the committed .sqlx/ query cache instead of a live DB.
ENV SQLX_OFFLINE=true
RUN touch src/main.rs src/bin/migrate.rs && cargo build --release

FROM debian:bookworm-slim AS runtime
WORKDIR /app

# ffmpeg: listing media processing (WebP renditions, video thumbnails, and
# rejecting uploads that aren't really images/videos) -- see src/media.rs.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/agriflow-api /usr/local/bin/agriflow-api

# Migrations are embedded into the binary at compile time by sqlx::migrate!,
# so no migrations/ directory is needed at runtime.
EXPOSE 8080
CMD ["/usr/local/bin/agriflow-api"]
