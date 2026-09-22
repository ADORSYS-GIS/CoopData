# EC2 Subdomain + SSL Report — `coopdata.dgrvcoop360.com`

**Date:** 2026-09-22
**Server:** `ec2-18-194-232-1.eu-central-1.compute.amazonaws.com` (18.194.232.1)
**Compose project:** `/home/ubuntu/CoopData` (Docker, all containers healthy)

---

## 1. What you did — is it correct?

**Yes, the DNS record is correct.**

| Item | Value | Status |
|------|-------|--------|
| Type | `A` | ✅ Correct |
| Name | `coopdata` | ✅ Correct (→ `coopdata.dgrvcoop360.com`) |
| Value | `18.194.232.1` | ✅ Correct (your EC2 public IP) |
| Proxy | **Proxied** (orange cloud) | ✅ Correct |

Verified: `coopdata.dgrvcoop360.com` resolves to Cloudflare IPs (`188.114.96.3` / `188.114.97.3`), which confirms the record is proxied through Cloudflare. The origin is reachable on both port 80 (301 → https) and 443 (200).

> **Important consequence of "Proxied":** Cloudflare terminates TLS at its edge and then makes a **second** connection to your EC2 on port 443. So your EC2 nginx **still needs a valid certificate** — the Cloudflare proxy does not remove that requirement. This is exactly the gap you asked about.

---

## 2. Current state on the EC2 (verified)

- **App:** Running in Docker (frontend, backend, Keycloak, Postgres, Redis, MinIO, Grafana, Prometheus, nginx-proxy). All healthy.
- **Reverse proxy:** Host-level **nginx** on ports 80/443.
  - `server_name` = `ec2-18-194-232-1.eu-central-1.compute.amazonaws.com` (the EC2 hostname, **not** your subdomain).
  - Uses a **self-signed certificate** (`/etc/nginx/ssl/coopdata-selfsigned.crt`).
- **Routing:** `/` → frontend (127.0.0.1:5174), `/api/` → backend (127.0.0.1:3000), `/auth/`, `/realms/`, `/admin/` → Keycloak (127.0.0.1:8180).
- **certbot:** NOT installed.
- **Frontend:** Uses **relative paths** for API and Keycloak (no hardcoded domain baked in) → **no frontend rebuild needed** for the domain change.

---

## 3. What is missing / needs to change

### 3.1 SSL certificate (the main gap)
The self-signed cert is the problem. Because your DNS is **proxied through Cloudflare**, the recommended fix is a **Cloudflare Origin Certificate** (free, 15-year validity, no renewal) — not Let's Encrypt.

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Cloudflare Origin Certificate** | Free, 15 years, no renewal, trusted by CF edge, perfect for proxied DNS | Must be created in CF dashboard | ✅ **Recommended** |
| Let's Encrypt (certbot) | Free, standard | 90-day renewal; with proxied DNS you must use DNS-01 (or ensure HTTP-01 passes through CF); more moving parts | ⚠️ Alternative |

**Cloudflare SSL mode must be set to `Full (strict)`** for the origin cert to be trusted (not "Flexible" — that causes redirect loops).

### 3.2 nginx config
- Change `server_name` to `coopdata.dgrvcoop360.com` (keep the EC2 hostname as a secondary if you still want direct access).
- Point `ssl_certificate` / `ssl_certificate_key` to the new origin cert.

### 3.3 Application config (`/home/ubuntu/CoopData/.env`)
These values are hardcoded to the old EC2 hostname and **must** be updated, then the affected containers restarted:

| Variable | Current | Change to |
|----------|---------|-----------|
| `FRONTEND_URL` | `https://ec2-...amazonaws.com` | `https://coopdata.dgrvcoop360.com` |
| `DOMAIN_NAME` | `https://ec2-...amazonaws.com` | `https://coopdata.dgrvcoop360.com` |
| `JWT_ISSUER_ALIASES` | `https://ec2-.../realms/coop-data, ...` | add `https://coopdata.dgrvcoop360.com/realms/coop-data` |
| Keycloak `KC_HOSTNAME` | `https://ec2-...amazonaws.com` | `https://coopdata.dgrvcoop360.com` |

> `KC_HOSTNAME` is the most important — if left unchanged, Keycloak keeps generating login/redirect/issuer URLs pointing to the old hostname and auth breaks.

### 3.4 Restart
After editing `.env`: restart **Keycloak** and **backend** (they read these values at startup). Frontend needs no change.

---

## 4. Recommended implementation steps

1. **Cloudflare dashboard**
   - SSL/TLS → set mode to **Full (strict)**.
   - SSL/TLS → Origin Server → **Create Certificate** for `coopdata.dgrvcoop360.com` (and optionally `*.dgrvcoop360.com`). Copy the PEM cert + private key.
2. **Install cert on EC2** → write to `/etc/nginx/ssl/coopdata-origin.crt` and `.key`.
3. **Update nginx** `server_name` + cert paths → `sudo nginx -t` → reload.
4. **Update `.env`** (section 3.3) → `docker compose up -d keycloak backend` (or full `up -d`).
5. **Verify** → `https://coopdata.dgrvcoop360.com` shows a valid lock, login works, `/api/` responds.

---

## 5. Verification results (before changes)

- Origin port 80: `301` (redirect to https) ✅
- Origin port 443: `200` ✅
- Via Cloudflare https: `200` ✅
- Current cert: self-signed, `CN = ec2-18-194-232-1.eu-central-1.compute.amazonaws.com`, valid Jul 2026 → Jul 2027 ⚠️ (replace)

---

## 6. ✅ COMPLETED — certbot implementation (2026-09-22)

Production uses `start-prod.sh` → `docker-compose.ghcr.yaml` (not `docker-compose.yml`).

### Done on the EC2
1. **Installed certbot** 4.0.0.
2. **nginx port 80** — added `location /.well-known/acme-challenge/` (webroot `/var/www/certbot`) before the HTTPS redirect.
3. **Issued Let's Encrypt cert** for `coopdata.dgrvcoop360.com` (webroot, HTTP-01 through Cloudflare proxy). Expires **2026-12-21**. Email used: `admin@dgrvcoop360.com`.
4. **nginx 443** — `server_name` → `coopdata.dgrvcoop360.com` (EC2 hostname kept as secondary); cert → `/etc/letsencrypt/live/coopdata.dgrvcoop360.com/{fullchain,privkey}.pem`. Reloaded.
5. **Auto-renewal** — certbot systemd timer active + deploy hook `/etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh` (reloads nginx on renewal). Dry-run: **success**.
6. **`.env` updated** (drives `docker-compose.ghcr.yaml`):
   - `FRONTEND_URL` → `https://coopdata.dgrvcoop360.com`
   - `DOMAIN_NAME` → `https://coopdata.dgrvcoop360.com` (this sets Keycloak `KC_HOSTNAME`)
   - `JWT_ISSUER_ALIASES` → added `https://coopdata.dgrvcoop360.com/realms/coop-data`
   - `VITE_KEYCLOAK_URL` → `https://coopdata.dgrvcoop360.com`
   - Backup of old `.env` saved as `.env.bak.*`
7. **Restarted** `keycloak` + `backend` via `docker compose -f docker-compose.ghcr.yaml up -d --no-build`. Both healthy.

### Verified working
| Check | Result |
|-------|--------|
| Frontend `https://coopdata.dgrvcoop360.com/` | 200 (title loads) |
| API `/api/v1/health` | 200 |
| Swagger `/swagger-ui/` | 200 |
| Keycloak realm well-known | 200, **issuer = `https://coopdata.dgrvcoop360.com/realms/coop-data`** |
| Keycloak login page | loads ("Sign in to coop-data") |
| HTTP → HTTPS redirect | 301 → new domain |
| Origin cert (direct to 18.194.232.1) | **Let's Encrypt**, CN=`coopdata.dgrvcoop360.com` |
| Cert auto-renewal dry-run | success |

### ⚠️ One remaining action for YOU (Cloudflare)
Switch **SSL/TLS mode from `Full` → `Full (Strict)`** now that the origin has a trusted Let's Encrypt cert. This validates the origin cert and is the most secure option.

---

## 7. ✅ FIXED — infinite refresh/login loop after refresh (2026-09-22)

### Symptom
Login works, but refreshing the app caused an infinite refresh/loading loop. Logs showed `Keycloak instance unauthenticated` on every reload.

### Root cause
**Path-prefix mismatch between the frontend and Keycloak's session cookie.**
- The frontend calls Keycloak via `/auth/realms/coop-data/...` (`keycloakConfig.ts` uses `${origin}/auth`).
- Keycloak sets its session cookie (`KEYCLOAK_IDENTITY`) with `Path=/realms/coop-data/` (because nginx strips the `/auth` prefix when proxying).
- The browser only sends a cookie when the request path matches the cookie path, so `/auth/realms/...` never carried the session cookie.
- Result: `check-sso` (silent iframe) always returned `login_required` → app treated the user as logged out → redirected to login → loop.

Verified by curl: check-sso via `/realms/...` returned authenticated (code), but via `/auth/realms/...` returned `login_required`.

### Fix (nginx only, no frontend rebuild)
Added `proxy_cookie_path /realms/coop-data/ /;` to all Keycloak-proxying locations (`/auth/`, `/realms/`, `/admin/`, `/resources/`, `/js/`). This rewrites Keycloak's `Set-Cookie Path=/realms/coop-data/` → `Path=/`, so the session cookie is sent for both `/auth/...` and `/realms/...` requests.

### Verification
- After login, `Set-Cookie` path is now `Path=/`.
- check-sso via `/auth/realms/...` now returns **authenticated** (302 with code) instead of `login_required`.
- Frontend 200, API 200, Keycloak 200.
- Diagnostic test user created during debugging was removed.
