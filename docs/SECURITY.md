# PENJAGA security controls

What protects the system, how to check it, and what it does not cover. **New** marks controls added by this hardening pass; the others were already in place.

## Enable the database controls

Sign-out revocation and the append-only audit trail need migration `011`. Changing a password needs migration `010`. Back up first, apply, then restart the API. Docker Compose applies migrations automatically.

```powershell
npm --prefix backend run db:status
```

```powershell
npm --prefix backend run db:backup
```

```powershell
npm --prefix backend run db:migrate
```

Without `011` the API still starts and works, but a token stays valid after sign-out until it expires, and audit rows can be changed.

## 1. Authentication and authorization

| Control | Behaviour |
| --- | --- |
| Password storage | bcrypt hashes. |
| Password policy (**new**) | For new and changed passwords: 10 characters to 72 bytes; rejects common words with digits or symbols added, digits only, fewer than four distinct characters, and the username with digits or symbols added. There are no composition rules (NIST SP 800-63B). Existing passwords are not re-checked. |
| Sessions | HS256 JWT valid for 12 hours. Production refuses a short or placeholder `JWT_SECRET`. A password change invalidates earlier tokens. |
| Sign-out (**new**) | `POST /api/auth/logout` revokes that token on the server. Other devices stay signed in. |
| Idle sign-out (**new**) | The web app signs out after 30 minutes without keyboard, mouse, wheel or touch input, including when reopened later. This is enforced by the browser app; a closed browser's token is revoked only when the app is next opened. |
| Login limits | 5 attempts per address and 40 in a burst per 15 minutes. **New:** 10 per account per 15 minutes, from any number of addresses. A successful sign-in resets the 5-per-address and per-account counters, but not the burst limit. |
| Account discovery (**new**) | Unknown usernames and wrong passwords return the same response after a bcrypt comparison. A disabled account is reported only after the correct password. |
| Role checks | The server checks the role on every protected route and reloads the account on every request, so disabling an account takes effect immediately. Guards are limited to their own records. Frontend route guards are for presentation only. |
| Administrator safety (**new**) | The server stops administrators from disabling or demoting their own account. |

## 2. Data security

- SQL values are passed as query parameters.
- Evidence files need a signed-in user who owns the record or has a supervising role. The content type comes from the file's signature, not its name.
- API responses are marked `no-store`. CSV exports neutralise spreadsheet formulas.
- **New:** the user list no longer returns identity card numbers, which no screen displayed.
- Database TLS certificates are verified when TLS is on: `PGSSL=true`, or with `DATABASE_URL` in production or with an SSL mode, unless the mode is `disable`.

## 3. Attack prevention

| Threat | Defence |
| --- | --- |
| Brute force and flooding | The login limits above, plus limits per address (600/min), per account (180/min), and on downloads, exports and report submission. |
| SQL injection | Parameterised queries. |
| Cross-site scripting | React escapes rendered text. **New:** the Nginx and Vercel builds send a Content Security Policy that blocks inline and third-party scripts. The API's policy allows nothing (`default-src 'none'`). The Vite development server sends no policy. |
| Cross-site request forgery | Sessions use an `Authorization` header, not cookies, so another site cannot send them automatically. |
| Clickjacking | `X-Frame-Options: DENY` and `frame-ancestors 'none'`. |
| Unwanted web origins | Production accepts only origins in `FRONTEND_URL`. **New:** development accepts those and this machine, instead of every origin. |
| Malicious uploads | Type allowlist, file-signature check, random stored names, and size and count limits. |

## 4. Infrastructure security

- The API container runs as an unprivileged user. **New:** it drops all Linux capabilities and blocks privilege escalation.
- Only Nginx publishes a port; PostgreSQL is not exposed by Docker Compose.
- **New:** Nginx hides its version and sends HSTS, `Permissions-Policy` and `Cross-Origin-Opener-Policy`. Compose serves plain HTTP on port 80, and browsers ignore HSTS over HTTP: **put TLS in front of it before real use.**
- CI runs `npm audit`. Automatic Dependabot version updates are not configured, so review dependency, container image and GitHub Action updates by hand.
- The Docker policy expects the API on the same origin (`/api`). If you host the API elsewhere, add its origin to `connect-src`, `img-src` and `media-src` in `nginx.conf`.

## 5. Security monitoring

- **New:** audit rows record the client address and browser (previously the address was always `System`). Behind a trusted proxy, set `TRUST_PROXY=1`, or every row shows the proxy's address. Only set it when a proxy overwrites `X-Forwarded-For`. Background jobs are still recorded as `System`.
- **New events:** `LOGOUT`, `CREATE_USER`, `UPDATE_USER`, `CREATE_POST`, `UPDATE_POST`, `ACCESS_DENIED` (at most one per user and route per minute) and `LOGIN_RATE_LIMITED` (once per lockout window).
- **New:** every active administrator is notified in the app when a login limit of 5 per address or 10 per account is reached.
- **New:** *Rekod aktiviti* shows the last 24 hours (`GET /api/audit/security-summary`, administrators only). It raises a warning for any lockout, 10 or more failed logins, or 10 or more recorded denials.
- **New** (migration `011`): database triggers reject updates, deletes and truncation of the audit trail.

## Check it

```powershell
node --test backend/tests/security.test.js
```

The test uses a disposable schema on the isolated demonstration database, like the other database tests.

## Not covered

- **No multi-factor authentication.** This is the most useful next control for administrator accounts.
- The token is kept in `localStorage`, so a script that got past the policy could read it. Moving to `HttpOnly` cookies would also need CSRF protection and compatible site hosting.
- Rate-limit counters are held in memory. They reset when the API restarts and are not shared between instances.
- Someone using two or more addresses can lock a known account for 15 minutes.
- Docker Compose connects the API as the database owner. The owner can remove the audit triggers, so use a separate role with fewer privileges in production.
- The audit trail has no retention period. It now holds IP addresses, which are personal data, so set a retention rule (consider the PDPA) and purge as the database owner.
- A failed login records the typed username. A password typed into that field by mistake would be stored.
- The application does not encrypt uploads or database backups at rest, or scan uploads for malware. Use disk encryption and protect backup copies.
- The Vercel policy allows any HTTPS origin for API requests and media because the API address is not fixed. Narrow it once the API is hosted.
- `database/seed.sql` creates demonstration accounts with a published password. Never load it in production.
- No independent penetration test has been done.
