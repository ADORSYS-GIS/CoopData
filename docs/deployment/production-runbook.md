# Production runbook

This is the single page to read before you run, update or recover a CoopData server. It describes what actually runs today. The other guides in this folder go deeper:

| Guide | Use it for |
| --- | --- |
| [`deployment-flow.md`](deployment-flow.md) | The branch and release pipeline in detail |
| [`manual-deployment.md`](manual-deployment.md) | Installing on a plain server step by step |
| [`docker-compose-specs.md`](docker-compose-specs.md) | Resource limits and options per service |
| [`../BACKUP_AND_RECOVERY_GUIDE.md`](../BACKUP_AND_RECOVERY_GUIDE.md) | Backups and disaster recovery |
| [`../MULTI_ENVIRONMENT_GUIDE.md`](../MULTI_ENVIRONMENT_GUIDE.md) | Running a demo stack beside production |
| [`../RELEASE_STRATEGY_GUIDE.md`](../RELEASE_STRATEGY_GUIDE.md) | Versioning and release rules |

## 1. What runs

Everything runs as Docker containers from [`docker-compose.ghcr.yaml`](../../docker-compose.ghcr.yaml). Only the backend and frontend images are built by CI and pulled from GitHub Container Registry. The rest are public images.

| Service | Image | Role |
| --- | --- | --- |
| `frontend` | `ghcr.io/adorsys-gis/coopdata-frontend` | The web app (React) |
| `backend` | `ghcr.io/adorsys-gis/coopdata-backend` | The API (Rust, Axum) |
| `nginx-proxy` | `nginx:1.27-alpine` | Internal reverse proxy that lets the host Nginx reach the frontend and the backend through one address |
| `postgres` | `postgres:16-alpine` | Application and Keycloak databases |
| `redis` | `redis:7-alpine` | Cache, rate limiting, one-time verification tokens |
| `minio` | `minio/minio` | File storage for uploaded documents |
| `keycloak` | `quay.io/keycloak/keycloak:26.4.6` | Sign-in, roles, two-step verification, branded login and email theme |
| `keycloak-provision` | same as Keycloak | One-shot job that configures Keycloak at every start (see section 4) |
| `gotenberg` | `gotenberg/gotenberg:7.9` | Renders report PDFs |
| `autoheal`, `docker-socket-proxy` | pinned images | Restarts containers that fail their health check |
| `prometheus`, `grafana`, exporters | pinned images | Metrics and dashboards |

A TLS-terminating Nginx on the host (see [`nginx-host.conf`](../../nginx-host.conf)) sits in front of the stack and serves the public domain. Certificates come from Let's Encrypt. It routes `/` to the frontend, `/api/` and `/swagger-ui/` to the backend, `/auth/` to Keycloak and `/grafana/` to Grafana. Sign-in token requests are rate limited there.

Only ports 22, 80 and 443 are public. The databases, Redis, MinIO and Keycloak are reachable only on the Docker network.

## 2. Configuration

All configuration is environment variables in a `.env` file at the project root on the server. It is never committed. Start from [`.env.example`](../../.env.example).

### Secrets that must be changed before first start

| Variable | What it is |
| --- | --- |
| `POSTGRES_PASSWORD`, `DATABASE_URL` | Database password (must match in both) |
| `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` | Keycloak console login |
| `KEYCLOAK_CLIENT_SECRET` | The backend's secret in Keycloak. Provisioning copies it onto the Keycloak client, so changing it here and re-running provisioning is enough |
| `COOPDATA_DGRV_ADMIN_*`, `COOPDATA_MINISTRY_ADMIN_*` | Email, password and name of the two first administrators created by provisioning |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | MinIO credentials |
| `GRAFANA_ADMIN_PASSWORD` | Grafana refuses to start without it |
| `SMTP_*` | Mail account used for invitation and verification emails |
| `AI_API_KEYS` | One or more keys of an OpenAI-compatible provider, comma separated (keys rotate on failure) |

### Settings that depend on the environment

| Variable | Meaning |
| --- | --- |
| `DOMAIN_NAME` | Public domain. Used for Keycloak links and to rewrite the frontend client's redirect addresses |
| `FRONTEND_URL` | Allowed browser origin (CORS) |
| `ENVIRONMENT` | `development` or `production` |
| `JWT_ISSUER`, `JWT_ISSUER_ALIASES`, `JWT_AUDIENCE` | Token checks. The alias lets tokens issued on the public address be accepted inside Docker |
| `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` | Where and how the backend talks to Keycloak |
| `REDIS_URL` | Redis address |
| `STORAGE_TYPE`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `STORAGE_PATH` | File storage: `s3` for the bundled MinIO (or another S3-compatible store), or a local path |
| `EXTRACTION_BACKEND` | `mock` returns fake data. Use the AI provider in production |
| `AI_PROVIDER_URL`, `AI_MODEL`, `AI_VISION_MODEL`, `AI_MAX_TOKENS` | AI extraction and report narratives |
| `GOTENBERG_URL`, `GOTENBERG_FRONTEND_URL`, `REPORT_JOB_TIMEOUT_SECS` | PDF rendering |
| `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_AUTH_WINDOW_SECS` | Limits on the sign-in endpoints, per IP |
| `RUST_LOG` | Log level of the backend (for example `info`) |
| `HOST`, `PORT` | Backend bind address |
| `BACKUP_S3_*`, `AWS_*` (credentials used by the S3 client, whichever S3-compatible provider holds the backups), `BACKUP_RETENTION_DAYS` | Where backups are sent and how long they are kept |
| `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, `AUTOHEAL_WEBHOOK_URL` | Alert and deployment notifications |
| `SECRETS_BACKEND` | `env` (default, secrets in `.env`), or `aws` / `vault` if the client runs a secrets manager. See [`scripts/load-secrets.sh`](../../scripts/load-secrets.sh) |

The frontend takes its settings at build time (`VITE_*`). The published image is built to use relative addresses, so the same image works on every domain. A CI check fails the build if an absolute host address ends up in the bundle.

## 3. First installation

1. Ask the client for a server (Ubuntu 24.04, see [`manual-deployment.md`](manual-deployment.md#phase-1--prepare-the-server)) with a DNS record for the domain pointing to it.
2. Copy the repository to `/opt/coopdata` (the path CI expects).
3. Create `.env` from `.env.example` and fill in section 2.
4. Run [`setup-ec2.sh`](../../setup-ec2.sh) (the name is historical; it works on any Ubuntu server) for a full host setup (Docker, Nginx, certificates), or follow [`manual-deployment.md`](manual-deployment.md).
5. Install the zero-downtime tool: `./scripts/install-docker-rollout.sh`.
6. Start the stack: `./start-prod.sh` (interactive) or `docker compose -f docker-compose.ghcr.yaml up -d`.
7. Sign in with the Ministry administrator you defined in `.env`. Then invite the first federation officers from the Invitations page.

The database schema is created from `backend/migrations/` when the database volume is empty. Existing databases are updated by `scripts/migrate-db.sh` (section 5).

## 4. Keycloak provisioning

`keycloak-provision` runs each time the stack is brought up. It is safe to run again. It:

- imports or updates the `coop-data` realm,
- creates the DGRV and Ministry administrators from `.env`,
- copies `KEYCLOAK_CLIENT_SECRET` onto the backend client so the backend and Keycloak always agree,
- rewrites the frontend client's redirect and post-logout addresses from `DOMAIN_NAME`,
- applies the SMTP settings and the branded theme.

Branded pages (login, password checklist, emails) live in `keycloak/themes/coopdata`.

## 5. Releasing and deploying

```
feature branch -> PR to develop -> merge to main -> release-please PR -> merge it -> tag vX.Y.Z -> deploy
```

1. Work on a branch, using Conventional Commits (`feat:`, `fix:`). Open the PR into `develop`.
2. When `develop` is ready, merge it into `main`. The release-please bot opens a release PR that computes the version and the changelog.
3. Merging the release PR creates the tag and the GitHub release.
4. The release triggers the **Docker Build, Scan & Publish** workflow: it builds the two images, scans them with Trivy, pushes them to GHCR, then runs the **deploy** job in the `production` environment.
5. The deploy job connects to the server by SSH, checks out the tag in `/opt/coopdata`, and runs [`scripts/deploy.sh`](../../scripts/deploy.sh). The script pulls the new images, applies pending database migrations, and rolls the backend and frontend out one at a time with `docker rollout` (a drop of under a second). It then checks `/api/v1/health` and the frontend.
6. Success and failure are posted to Discord (and failure to Slack).

Branches named `deploy`, `deploy-*` and `deployed-*` build images tagged `latest` but do not deploy by themselves. They are used to promote a tested state of `develop` to the server.

### Repository secrets and settings that the pipeline needs

`PROD_HOST`, `PROD_USER`, `PROD_PATH` (optional, default `/opt/coopdata`), `PROD_SSH_KEY` or `PROD_PASSWORD`, and the Discord and Slack webhooks. The `production` environment should require reviewers. The manual run of the workflow (`workflow_dispatch`) is an emergency path that deploys any tag and uses the `production-manual` environment, which must also require reviewers.

### Deploying by hand

On the server, in `/opt/coopdata`:

```bash
./scripts/deploy.sh              # latest backend and frontend
./scripts/deploy.sh v1.7.0       # a specific release
./scripts/deploy.sh backend      # one service only
```

### Rolling back

Deploy the previous release tag: `./scripts/deploy.sh vX.Y.Z`. Migrations are not undone by a rollback, so check that the older version works with the current schema. If data was damaged, use the restore procedure in section 7.

### What a deploy does not touch

`deploy.sh` rolls out only the backend and frontend. Changes to Keycloak, its theme, Nginx, Prometheus or the other services need their own step:

- **Keycloak theme or provisioning changes:** pull the repository, restart Keycloak and re-run provisioning in a quiet period, because Keycloak caches theme files until it restarts.
- **Compose file changes:** run `docker compose -f docker-compose.ghcr.yaml up -d` for the affected service.

## 6. Day-to-day operations

```bash
docker compose -f docker-compose.ghcr.yaml ps              # status and health
docker compose -f docker-compose.ghcr.yaml logs -f backend # follow the backend log
curl -s http://localhost:3000/api/v1/health                # API health
```

- **Dashboards and alerts:** Grafana shows metrics from Prometheus. Alerts and the self-healing restarts go to the Slack or Discord webhook. See [`../operations/observability-monitoring.md`](../operations/observability-monitoring.md).
- **Audit trail:** the Ministry can read every action on the platform in the Audit Log page.
- **Logs:** everything is written to the container output, nothing to files.
- **Security scans:** CI runs Trivy on every image build, and a separate security workflow (secrets and dependency scan) runs on every pull request into `main` or `develop`.

### Rules that keep data safe

- Never run `docker compose down -v` or remove a volume. The volumes hold the databases, the files and the Keycloak data.
- Take a backup before any change that touches the database or Keycloak.
- Reload a service rather than restarting the whole stack, and do it in a quiet period.
- After a reset of the database, check that its logging settings were re-applied if you use database audit logging.

## 7. Backups and recovery

[`scripts/backup-production.sh`](../../scripts/backup-production.sh) saves the application database, the Keycloak database and configuration, and the MinIO files to offsite S3-compatible storage. Schedule it on the host with cron:

```
0 2 * * * /opt/coopdata/scripts/backup-production.sh >> /var/log/coopdata-backup.log 2>&1
```

To restore, run `./scripts/restore-production.sh` (choose a date from the list), or `./scripts/restore-production.sh 2026-08-25`. Full details, targets and drills are in the [backup guide](../BACKUP_AND_RECOVERY_GUIDE.md). Test a restore on a spare server at least once a quarter.

## 8. Common incidents

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Nobody can sign in, login page errors | Keycloak down or unhealthy | Check `ps` and the Keycloak log. Autoheal restarts it after repeated failed checks |
| Sign-in works, API returns 401 | Backend and Keycloak secret differ, or token issuer mismatch | Compare `KEYCLOAK_CLIENT_SECRET` in `.env` with Keycloak, then re-run provisioning. Check `JWT_ISSUER` and `JWT_ISSUER_ALIASES` |
| No invitation or verification email | SMTP settings wrong, or the mail account blocks the app | Check `SMTP_*` in `.env`. The backend now removes a newly created user if the email cannot be sent, so the request fails cleanly and can be repeated |
| Report stays "preparing" | Gotenberg down, or the job exceeded `REPORT_JOB_TIMEOUT_SECS` | Check the `gotenberg` container. A timed-out job can be retried from the app |
| Uploaded statement never finishes extraction | AI provider key invalid or rate-limited, or `EXTRACTION_BACKEND=mock` | Check `AI_API_KEYS` and the provider quota |
| Theme or login page change not visible | Keycloak and the CDN cache theme files | Restart Keycloak and purge the CDN cache |
| Disk almost full | Docker images, logs or backups | Prune unused images, check log size and `BACKUP_RETENTION_DAYS` |
| Deployment failed in CI | Image build, scan or SSH problem | Read the workflow log. The previous version keeps running because rollouts are one at a time |

## 9. Known open items

- A deploy does not restart Keycloak or the autoheal service when their files change (section 5).
- Theme files can stay cached after a theme change. Adding a version to the theme's file addresses would fix it.
- Some theme messages that contain a single quote render without it. Quotes must be doubled in those message files.
- `keycloak/backfill-mfa-attribute.sh` needs Python, which the Keycloak image lacks. It fails harmlessly on a fresh install.
- The siSwati texts in the Keycloak theme need a review by a native speaker.
- The per-incident runbooks in [`../knowledge/runbooks.md`](../knowledge/runbooks.md) are still a template. The table above is the working list until they are written.
