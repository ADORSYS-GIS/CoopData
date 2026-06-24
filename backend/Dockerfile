# Dockerfile for backend (Rust Axum)
FROM rust:1.75-slim AS builder
WORKDIR /app
# Install build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
# Copy Cargo files for dependency caching
COPY Cargo.toml Cargo.lock* ./
# Create dummy main to compile dependencies first
RUN mkdir src && echo "fn main() {}" > src/main.rs
# Build dependencies only (this layer is cached unless Cargo.toml changes)
RUN cargo build --release
# Remove dummy files
RUN rm -rf src
# Copy actual source code
COPY src ./src
# Touch the main file to force cargo to rebuild it
RUN touch src/main.rs
# Build the application
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/coop-data-backend ./coop-data-backend
ENV RUST_LOG=info
EXPOSE 8080
CMD ["./coop-data-backend"]
