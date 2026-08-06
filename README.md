# SkinnyStatus

A lightweight, self-hosted Statuspage alternative: an **admin portal** that monitors services, plus **static status apps** you deploy to Vercel, Cloudflare Pages, Netlify, GitHub Pages, static.app, Amazon S3, Firebase Hosting, or Azure Static Web Apps.

- **Projects**: each project is one public status page owned by a team (theme, publish mode, host provider)
- **Static deploy**: one-click push of a Svelte status SPA that polls this portal’s public JSON API
- **Preview**: Dashboard → Projects → Preview shows the live board (theme + 90-day bars) before Deploy
- **Live data**: status and 90-day uptime bars update without redeploying the static app
- Path (`/s/{slug}`) or subdomain (`{slug}.your.domain`) publishing per project
- Admin UI for projects, services, incidents, and manual overrides
- Optional HTTP health checks on an interval
- Postgres via Drizzle
- Local email/password users plus optional GitHub / Google OAuth
- Config: **Infisical** (when credentials are set) or environment / `.env`

## Quick start

```sh
npm install
cp .env.example .env
# Set DATABASE_URL to your Postgres instance (or Infisical /db/url)
npm run build:status-template   # once (or after editing the template)
npm run dev
```

On every startup the app applies pending SQL migrations from `drizzle/pg` (idempotent). For a one-off push without migrations, `npm run db:push` still works; prefer `db:generate` + migrate for schema changes.

Open [http://localhost:5173](http://localhost:5173).

In development (or when `SEED_EXAMPLE_USER=1`), a test account is ensured if missing:

- Email: `demo@example.com`
- Password: `demo-password`

Anyone can also **[create an account](/signup)**.

## Architecture

| Piece | Role |
|-------|------|
| Admin portal (this app) | Projects, monitors, incidents, theme, deploy; runs HTTP checks |
| Public API | `GET /api/v1/pages/{slug}` (+ `/uptime`, `/incidents/{id}`); CORS open |
| Static status app | Built from `packages/status-page-template`; hosted on your provider |

Set `ORIGIN` to the admin portal’s public URL so deployed status pages know where to fetch.

## Publishing

Each **project** sets publish settings (Dashboard → Projects):

| Setting | Meaning |
|---------|---------|
| Slug | Unique public path/subdomain label |
| Base domain | Apex for subdomain URL hints / DNS copy (`{slug}.your.domain`) |
| Path prefix | Path segment for path-mode deploy nesting (`/{prefix}/{slug}/` on the static host) |

Optional env `PUBLISHING_BASE_DOMAIN` / `PUBLISHING_PATH_PREFIX` are unused for runtime; prefer project fields.

Each project also chooses **mode** and **host provider**:

| Mode | Example public URL |
|------|--------------------|
| `path` | `https://your-site.vercel.app/s/acme` (prefix comes from the project) |
| `subdomain` | `https://acme.status.example.com` (CNAME to the provider; DNS is operator-owned) |

Admin preview is always at `{ORIGIN}/s/{slug}` (platform-fixed path), independent of the project's publish path prefix.

### One-click deploy credentials

Each **team** saves host credentials under **Dashboard → Settings**. Tokens are encrypted at rest in Postgres (`team_host_credential`) and used for deploys of that team's projects. Team admins and owners can edit them; members can deploy using the team's credentials. They are never taken from Infisical or platform env.

| Provider | Fields |
|----------|--------|
| Vercel | Token, optional Team ID |
| Cloudflare Pages | API token, Account ID |
| Netlify | Token |
| GitHub Pages | Token, Owner (user or org) |
| static.app | API key |
| Amazon S3 | Access key ID, secret access key, bucket, region, public base URL |
| Firebase Hosting | Site ID, service account JSON |
| Azure Static Web Apps | Deployment token, public base URL |

Platform Mailgun (subscribe alerts) is loaded from Infisical path **`/mailgun`** (`api_key`, `domain`, `from`, optional `region`), or from `MAILGUN_*` env when Infisical is unset.

### Email subscriptions

Viewers can **Subscribe** on a status page to receive Mailgun emails when incidents are created or updated. Each email includes an unsubscribe link (`/api/v1/unsubscribe?token=…`).

With Infisical, set secrets under **`/mailgun`** (`api_key`, `domain`, `from`, optional `region`). Without Infisical, set `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `MAILGUN_FROM`. Use `region=eu` / `MAILGUN_REGION=eu` for EU Mailgun.

Deploy builds from the prebuilt template (`npm run build:status-template`), injects `config.js` (`apiBase`, slug, theme), and uploads via the provider API. Missing credentials show a clear error in admin.

### DNS for subdomains

Point a wildcard at your **static host** (or CDN), not the admin portal:

```
*.status.example.com  →  provider (CNAME)
```

Set the project's base domain in Dashboard → Projects for URL hints. Keep `ORIGIN` on the admin apex.

### Local path-mode preview

Admin preview (platform path `s`):

[http://localhost:5173/s/default](http://localhost:5173/s/default)

Public API example:

[http://localhost:5173/api/v1/pages/default](http://localhost:5173/api/v1/pages/default)

## Configuration

Host environment supplies Infisical machine-identity credentials (or app secrets for local/dev).

When `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, and `INFISICAL_PROJECT_ID` are set, the app loads secrets from that Infisical project at startup. Infisical values overwrite matching keys already in the environment.

Resolution order:

```
Infisical (when credentials set) → process.env / .env → built-in default
```

### Infisical credentials (host env only)

| Setting | Env |
|---------|-----|
| Client ID | `INFISICAL_CLIENT_ID` |
| Client secret | `INFISICAL_CLIENT_SECRET` |
| Project ID | `INFISICAL_PROJECT_ID` |
| Environment slug | `INFISICAL_ENVIRONMENT` (default `dev`) |
| Site URL (self-hosted) | `INFISICAL_SITE_URL` (optional) |

App secrets in Infisical use path-based secrets where noted. The Postgres connection string is **`/db/url`**. Auth secret is **`/app/auth_secret`**. Mailgun is under **`/mailgun`**. GitHub OAuth is under **`/oauth/github`**. Google OAuth is under **`/oauth/google`**. Private avatar storage is under **`/r2`**. Stripe is under **`/stripe`**. Static-host deploy tokens are **not** Infisical secrets; teams enter them in Dashboard → Settings.

### App settings

| Setting | Env var(s) |
|---------|------------|
| Site description | `SITE_DESCRIPTION` |
| Public base URL (API + admin) | `ORIGIN`, `BASE_URL`, `SITE_BASE_URL` |
| Database URL | Infisical `/db/url`, or `DATABASE_URL` when Infisical is unset |
| Publish base domain / path prefix | Per project (Dashboard → Projects) |
| Credentials encryption key | `CREDENTIALS_ENCRYPTION_KEY` (optional; else derived from `AUTH_SECRET`) |
| Mailgun API key / domain / from | Infisical `/mailgun` (`api_key`, `domain`, `from`), or `MAILGUN_*` when Infisical is unset |
| Mailgun region | Infisical `/mailgun/region`, or `MAILGUN_REGION` (`us` \| `eu`) |
| Auth secret | Infisical `/app/auth_secret`, or `AUTH_SECRET` / `BETTER_AUTH_SECRET` when Infisical is unset |
| GitHub OAuth client | Infisical `/oauth/github` (`client_id`, `client_secret`), or `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` |
| Google OAuth client | Infisical `/oauth/google` (`client_id`, `client_secret`), or `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| Cloudflare R2 (avatars) | Infisical `/r2` (`account_id`, `access_key_id`, `secret_access_key`, `bucket`, optional `endpoint`/`region`), or `R2_*` |
| Stripe billing | Infisical `/stripe` (`secret_key`, `webhook_secret`, `price_bronze`…), or `STRIPE_*` |
| Check interval / timeout / degraded | `CHECKS_*` |

### Accounts

- Sign up / sign in with email+password (username or email), GitHub OAuth, or Google OAuth
- Profile, avatar (R2), password reset, TOTP 2FA, and WebAuthn passkeys under **Dashboard → Account**
- Soft-deleted accounts have a 30-day reactivation window (email link + sign-in → Reactivate)
- Soft-deleted projects have a 7-day undelete window; unpublish takes a page offline without deleting it

### Teams

- Team membership is **required**. After sign-up (without an invite), you create your first team before using the dashboard
- Joining via invite adds you to that team and skips the create-team step
- Create additional teams from the nav team switcher (**Create new Team**); the creator is the **owner**
- Every **project** belongs to exactly one team. Access is via team membership
- Hierarchy: **Team → Projects → Services / Incidents**. The nav team switcher selects the active team; Services and Incidents also pick a project
- **Dashboard** is the team landing page (hero banner + that team's projects)
- **Settings** is for the active team: deploy credentials, members, invites, and hero banner
- Owners and **admins** can invite by email and/or shareable link (`/invite/{token}`), manage members, create/delete projects, and edit team credentials/banner
- Members can edit, publish, and deploy the team's projects (using team credentials)
- Invite links land on sign-in/sign-up, then add the user to the team after authentication
- Hero banners are stored in the same private R2 bucket as avatars

### Billing (Stripe)

Plans are owned by a **billing org** (not by a team). Each user gets a home billing org on Free. Teams they create attach to that org. Limits:

| Plan | CAD/mo | Teams | Pages / team | Services / page |
|------|--------|-------|--------------|-----------------|
| Free | $0 | 1 | 2 | 3 |
| Bronze | $3 | 1 | 3 | 5 |
| Silver | $5 | 2 | 5 | 10 |
| Gold | $9 | 5 | 10 | 10 |
| Platinum | $20 | 10 | 20 | 20 (+ SSO entitlement; SSO UI later) |

Soft-deleted projects do not count toward page limits. Downgrades keep existing resources and block creates until you are within the new caps or upgrade again.

Checkout and the Customer Portal live under **Dashboard → Billing**. New paid plans use **Managed Payments** Checkout (`managed_payments[enabled]=true`). Stripe is merchant of record for tax, fraud, and dispute handling on those sessions. Webhooks: `POST /api/stripe/webhook`.

Create (or update) Stripe Products with tax code **`txcd_10103100`** (eligible for Managed Payments) and **CAD recurring monthly** Prices, accept the Managed Payments Terms of Service in the Dashboard, then set:

| Setting | Env / Infisical |
|---------|-----------------|
| Secret key (prefer restricted `rk_`) | `STRIPE_SECRET_KEY` or `/stripe/secret_key` |
| Publishable key (optional; Dashboard only) | `STRIPE_PUBLISHABLE_KEY` from [API keys](https://dashboard.stripe.com/apikeys) |
| Webhook signing secret | `STRIPE_WEBHOOK_SECRET` or `/stripe/webhook_secret` |
| Price IDs | `STRIPE_PRICE_BRONZE` / `SILVER` / `GOLD` / `PLATINUM` or `/stripe/price_*` |

Point the webhook at `{ORIGIN}/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.*`. Existing non-Managed subscriptions stay on the Customer Portal / subscription update path; only new Checkout Sessions use Managed Payments.

### Database

Postgres only. With Infisical credentials set, the URL is loaded from secret **`/db/url`**. Without Infisical, set:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/skinnystatus
```

Schema changes:

```sh
npm run db:generate   # write SQL under drizzle/pg
npm run db:migrate    # apply now (also runs automatically on app startup)
```

`npm run db:push` remains available for local prototyping without writing migration files.

### GitHub OAuth

Enables **Sign up with GitHub** and **Continue with GitHub** on `/signup` and `/dashboard/login`.

1. Create a GitHub OAuth App with callback `{ORIGIN}/api/auth/callback/github`
2. Set credentials via Infisical (`/oauth/github/client_id`, `/oauth/github/client_secret`) or env (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
3. Restart; the GitHub buttons appear when both values are set

GitHub accounts are linked automatically when the email matches an existing user.

### Google OAuth

Enables **Sign up with Google** and **Continue with Google** on `/signup` and `/dashboard/login`.

1. Create an OAuth 2.0 Client ID in Google Cloud Console (Web application) with authorized redirect URI `{ORIGIN}/api/auth/callback/google`
2. Set credentials via Infisical (`/oauth/google/client_id`, `/oauth/google/client_secret`) or env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
3. Restart; the Google buttons appear when both values are set

Google accounts are linked automatically when the email matches an existing user.

## Status rules

For each service:

1. Manual override wins if set
2. Else latest HTTP check result (failure → major outage; slow success → degraded)
3. Else operational

Overall banner uses the worst of active incident impact and service statuses (scoped to that project).

## Production

```sh
npm run build:status-template
npm run build
npm start
```

Uses `@sveltejs/adapter-node`. **`ORIGIN` must match the admin apex URL** browsers use (CSRF/auth). Prefer Infisical (or env) for secrets; do not commit them.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build (admin portal) |
| `npm run build:status-template` | Build static status SPA used by Deploy |
| `npm start` | Run production server with `.env` |
| `npm run db:push` | Push schema without migration files |
| `npm run db:generate` | Generate SQL migrations under `drizzle/pg` |
| `npm run db:migrate` | Apply pending migrations (also on every app startup) |
| `npm run db:studio` | Drizzle Studio |
| `npm test` | Unit tests |
| `npm run check` | Typecheck |

## License

Mozilla Public License 2.0. See [LICENSE](LICENSE).
