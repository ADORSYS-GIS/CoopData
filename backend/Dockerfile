FROM rust:1.88-bookworm AS builder

WORKDIR /app

COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src target/release/coop-data-backend target/release/.fingerprint/coop-data-backend-*

COPY backend/src ./src
RUN cargo build --release --bin coop-data-backend

FROM debian:bookworm-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/coop-data-backend /app/coop-data-backend

RUN groupadd -r appuser && useradd -r -g appuser appuser
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=30s \
  CMD curl -sf http://localhost:3000/api/v1/health || exit 1

CMD ["/app/coop-data-backend"]