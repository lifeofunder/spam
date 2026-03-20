# Email SaaS MVP Foundation

Monorepo for an email SaaS starter with:

- `apps/web` - Next.js frontend (login/register/dashboard/contacts/templates/campaigns/sequences)
- `apps/api` - NestJS backend (health + JWT auth + Prisma)
- `packages/shared` - shared DTO/types package

## Stack

- Next.js + TypeScript
- NestJS + TypeScript
- Prisma ORM
- PostgreSQL + Redis via Docker Compose
- ESLint + Prettier

## 1) Prerequisites

- Node.js 20+
- Docker Desktop

## 2) Install

```bash
npm install
```

## 3) Full first run (single command)

```bash
npm run dev:all
```

This single command:

- starts PostgreSQL + Redis
- creates local env files from examples
- generates Prisma client
- applies Prisma migration
- seeds a demo user
- starts API + Web in dev mode

## 4) Alternative step-by-step startup

```bash
npm run dev:infra
npm run dev:prepare
npm run dev:apps
```

This command set:

- starts PostgreSQL + Redis containers
- creates `.env` files from examples (if missing)
- generates Prisma client
- applies Prisma migration
- runs seed user creation
- starts API + Web

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`

## One-command dev start (after first setup)

```bash
npm run dev
```

## Seed test credentials

- Email: `demo@saas.local`
- Password: `Demo12345!`

## API endpoints

- `GET /health`
- `POST /webhooks/mail/generic` — inbound mail events (header `X-Webhook-Secret`, no JWT); see **Inbound mail webhooks**.
- `POST /webhooks/mail/sendgrid` — SendGrid Event Webhook adapter (same auth).
- `POST /auth/register` — body `{ name, email, password, acceptTerms: true }`; optional `turnstileToken` if `TURNSTILE_SECRET_KEY` is set. Sends verification email (`MAIL_MODE=smtp` recommended). New users have `emailVerifiedAt = null` until they confirm.
- `POST /auth/login`
- `GET /auth/me` (Bearer token) — includes `emailVerified: boolean`.
- `POST /auth/verify-email` — body `{ token }` from email link (**200**, returns new `accessToken` + `user`).
- `POST /auth/resend-verification` (Bearer) — **200**, rate-limited per user id.
- `POST /auth/forgot-password` — body `{ email }`; **always 200** `{ ok: true }` (no user enumeration). Optional `turnstileToken` if Turnstile enabled.
- `POST /auth/reset-password` — body `{ token, password }` (**200**, returns tokens).

**Email verification & marketing routes:** until `emailVerifiedAt` is set, JWT works for read-only app use, but **`EmailVerifiedGuard`** blocks: **CSV import**, **template** create/update/delete/test-send, **campaign** create/update/schedule/cancel-schedule/send-now, **sequence** create/update/activate/archive/enroll. **GET** list/detail endpoints stay available. Billing endpoints are unchanged.

**Transactional email:** verification and reset use the same `MailProvider` as the rest of the stack. For real delivery set `MAIL_MODE=smtp` and SMTP vars; in `console` mode, check API logs (tokens are **never** logged; only user id / action).

**Token storage:** only **hashes** of the secret segment are stored (`AUTH_TOKEN_PEPPER` or fallback `JWT_SECRET`). Links use format `userId.base64urlSecret`.

**Rate limits (@nestjs/throttler):** `register`, `login`, `verify-email`, `forgot-password`, `reset-password`, `resend-verification` (see `auth.controller.ts`).

**Optional Turnstile:** set `TURNSTILE_SECRET_KEY` on the API; pass `turnstileToken` from a Turnstile widget on register/forgot (web placeholder: `apps/web/src/lib/turnstile-placeholder.ts`).

**Public web:** landing `/`, `/pricing`, `/legal/terms`, `/legal/privacy`, `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`. Set `NEXT_PUBLIC_WEB_URL` for correct links in emails and OpenGraph `metadataBase`.

### Sequences — email automations (JWT + workspace scope)

- `POST /sequences` — create **DRAFT** + `steps[]`: `{ order, templateId, delayMinutes }` (`delayMinutes` = wait after the **previous** step before this email; step `1` often `0`).
- `GET /sequences` — list with step/enrollment counts.
- `GET /sequences/:id` — detail + ordered steps + template summary.
- `PATCH /sequences/:id` — **DRAFT only**: `name`, replace `steps[]`.
- `POST /sequences/:id/activate` — **DRAFT → ACTIVE** (requires ≥1 step).
- `POST /sequences/:id/archive` — **→ ARCHIVED**; all **ACTIVE** enrollments → **CANCELLED** and pending Bull jobs removed (best-effort). No new enrollments.
- `POST /sequences/:id/enroll` — body `{ "contactIds": ["…"] }` (MVP). Contacts must be **SUBSCRIBED** in the workspace. Idempotent skip if `(sequenceId, contactId)` already exists.
- `GET /sequences/:id/enrollments?page=&pageSize=` — paginated enrollments + last few `MessageEvent` rows per enrollment.

**BullMQ queue:** `sequence-dispatch` (same Redis as campaigns). **Job names:** `sequence-step-send`, `sequence-advance`. **Job ids:** `sequence-step-{enrollmentId}-{stepOrder}`, `sequence-advance-{enrollmentId}-{nextStepOrder}`.

**Pipeline:** `sequence-step-send` sends via `buildEmailWithCompliance` + `MailProvider`, writes **`MessageEvent`** with `campaignId = null` and `sequenceId`, `sequenceEnrollmentId`, `sequenceStepOrder` set. After a successful send, a delayed **`sequence-advance`** job waits `delayMinutes` of the **next** step, then enqueues **`sequence-step-send`** for that step. Sends share the same per-workspace rate limit key as campaigns (`CAMPAIGN_WORKSPACE_EMAILS_PER_MINUTE`).

**Stop conditions (MVP):** enrollment **CANCELLED** and pending jobs removed when: contact is no longer **SUBSCRIBED** (worker checks before send), **public unsubscribe**, **POST /contacts/:id/unsubscribe**, **hard bounce / complaint** webhook path, or sequence **ARCHIVED**. **BOUNCED** contacts are skipped by the worker and enrolments are cancelled when suppression runs.

**Web:** `/dashboard/sequences`, `/dashboard/sequences/new`, `/dashboard/sequences/[id]` (activate, archive, enroll by contact IDs, enrollment table).

### Contacts (JWT + workspace scope)

- `POST /contacts/import-csv` — `multipart/form-data`, field `file` (CSV). Max size: `CSV_IMPORT_MAX_BYTES` (default 1 MiB). Response: `{ inserted, updated, skipped, errors: [{ line, message }] }`.
- `GET /contacts?query=&tag=&page=&pageSize=` — list + search + tag filter + pagination (`pageSize` max 100).
- `PATCH /contacts/:id` — partial update (`firstName`, `lastName`, `company`, `phone`, `tags`).
- `POST /contacts/:id/unsubscribe` — sets status `UNSUBSCRIBED`.

### Templates (JWT + workspace scope)

- `POST /templates` — create (`name`, `subject`, `html`, optional `text`).
- `GET /templates` — list (no body in fields).
- `GET /templates/:id` — full template for editing.
- `PATCH /templates/:id` — partial update.
- `DELETE /templates/:id` — delete (blocked if used by a campaign).
- `POST /templates/:id/test-send` — body `{ "email": "...", "sampleVariables": { "firstName": "..." } }` (optional JSON vars).

### Campaigns (JWT + workspace scope)

- `POST /campaigns` — create draft: `name`, `templateId`, optional `query`, `tag`, optional **`scheduledAt`** (ISO 8601). If `scheduledAt` is set, a **delayed** BullMQ job `scheduled-start` is added with fixed id `campaign-schedule-{campaignId}` (same queue as sends).
- `PATCH /campaigns/:id` — partial update (**`DRAFT` only**): `name`, `templateId`, `query`, `tag`, **`scheduledAt`**. Use **`scheduledAt: null`** (JSON null) to clear the planned time; changing `scheduledAt` replaces the delayed job. All datetimes are parsed as JavaScript `Date` (UTC instant); send an explicit offset or **`Z`** (recommended).
- `POST /campaigns/:id/schedule` — (re)register the delayed job from the current row’s `scheduledAt`, or pass **`{ "scheduledAt": "<ISO>" }`** to set time and enqueue in one call. Requires **`DRAFT`** and a future time (≥ **15s** ahead, server clock UTC).
- `POST /campaigns/:id/cancel-schedule` — removes delayed job `campaign-schedule-{id}` from Redis and clears `scheduledAt` / `scheduleJobId`; campaign stays **`DRAFT`**.
- `GET /campaigns` — list + `messageStats` (queued / sent / failed). Fields **`scheduledAt`**, **`scheduleJobId`**. UI shows a **SCHEDULED** badge when `DRAFT` and `scheduledAt` is set.
- `GET /campaigns/:id` — detail + template summary + `messageStats` + `subscribedAudienceCount` + `sendJobId` / schedule fields.
- `GET /campaigns/:id/send-status` — `campaignStatus`, dispatch `jobState` / `progress` while **`SENDING`**, plus **`scheduledAt`**, **`scheduleJobId`**, **`scheduleJobState`** (Bull state for the delayed job when **`DRAFT`** and scheduled).
- `POST /campaigns/:id/send-now` — unchanged: enqueues **`dispatch`** job `campaign-send-{id}`. First **cancels** any pending delayed schedule for that campaign, then runs the same pipeline as the scheduler.

**Timezone:** the API does not store a separate timezone; **`scheduledAt` is an instant in UTC** (e.g. `2026-03-22T14:30:00.000Z`). Clients should send ISO strings with **`Z`** or a numeric offset (`+02:00`). The web UI uses `datetime-local` and converts with `toISOString()`.

**Idempotency:** **`scheduleJobId`** on the campaign matches the Bull **`jobId`** `campaign-schedule-{id}`. **`sendJobId`** remains the id for the **`dispatch`** job `campaign-send-{id}`.

**Worker:** must run for delayed sends. When `scheduled-start` fires, if the campaign is not **`DRAFT`** (e.g. already sent or cancelled), the handler **no-ops** and clears stale schedule fields; otherwise it calls the same **`enqueueDispatch`** path as **send-now**.

Background worker (separate process) processes the queue: **`scheduled-start`** (enqueue dispatch) and **`dispatch`** (batched sends): **SUBSCRIBED** only, template render, `MailProvider`, `MessageEvent` rows, per-workspace Redis rate limit, retries on transient SMTP errors.

Template placeholders in `subject` / `html` / `text`: `{{email}}`, `{{firstName}}`, `{{lastName}}`, `{{fullName}}`, `{{company}}`, `{{phone}}`, `{{tags}}`, `{{unsubscribeUrl}}` (see **Public unsubscribe** below).

### Billing & Stripe (subscriptions + plan limits)

**Plans (code):** `FREE` — 500 contacts, 2 000 emails/month (UTC calendar month), 1 active sequence. `PRO` — 50 000 contacts, 200 000 emails/month, 20 active sequences. Effective quotas depend on `Workspace.planKey` + `subscriptionStatus` (see `GET /billing`).

**HTTP style:** exceeding a limit or **`PAST_DUE`** subscription → **`402 Payment Required`** with JSON `{ message, code?, ... }`.

**Workspace fields (Prisma):** `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus` (`NONE` | `ACTIVE` | `PAST_DUE` | `CANCELED` | `INCOMPLETE`), `planKey` (`FREE` | `PRO`), `currentPeriodEnd`. **`WorkspaceEmailUsage`** stores per-workspace **`periodKey`** `YYYY-MM` (UTC) + `emailsSent`. **`StripeWebhookEvent`** stores idempotent **`stripeEventId`**.

| Route | Auth | Purpose |
| ----- | ---- | ------- |
| `GET /billing` | JWT | Summary: plan, status, period end, limits, usage |
| `POST /billing/checkout-session` | JWT | Stripe Checkout for Pro subscription (`STRIPE_PRICE_PRO_MONTHLY`) |
| `POST /billing/portal-session` | JWT | Stripe Customer Portal (requires `stripeCustomerId`) |
| `POST /webhooks/stripe` | Stripe signature | Billing webhooks (**raw body**; no JWT) |

**Webhooks handled:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Idempotency: **`StripeWebhookEvent.stripeEventId`**. In **`NODE_ENV=production`**, webhook logs avoid full payloads (id + type only).

**Enforcement (MVP):** CSV import (new rows), template **test-send**, campaign **create/update/schedule/send-now** (incl. scheduled Bull path via `enqueueDispatch`), sequence **create/update/activate/enroll**, and each **successful** campaign/sequence send increments monthly usage. **`PAST_DUE`** blocks the same marketing actions (not read-only billing).

**Worker:** run `npm run worker --workspace @email-saas/api` so quota checks + usage increments apply to queued sends.

**Env (API):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, optional `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `STRIPE_PORTAL_RETURN_URL` (defaults use `PUBLIC_WEB_URL` + `/dashboard/billing`).

**Local Stripe CLI (test mode):**

```bash
stripe login
stripe listen --forward-to localhost:4000/webhooks/stripe
# copy the webhook signing secret into STRIPE_WEBHOOK_SECRET for local API .env
```

**Web:** `/dashboard/billing` (Upgrade / Manage billing), dashboard layout banner when `PAST_DUE`.

## Public unsubscribe (compliance)

| Variable | Meaning |
| -------- | ------- |
| `UNSUBSCRIBE_SECRET` | HMAC secret used to sign unsubscribe tokens (required for `GET /unsubscribe` and signed links in mail) |
| `PUBLIC_WEB_URL` | Origin of the Next.js app for links in emails, e.g. `http://localhost:3000` (no trailing slash) |
| `UNSUBSCRIBE_TOKEN_TTL_DAYS` | Optional; if set to a positive number, tokens include an `exp` claim and expire after that many days |

**Link format:** when both `UNSUBSCRIBE_SECRET` and `PUBLIC_WEB_URL` are set, each outgoing campaign/test email gets `unsubscribeUrl` = `{PUBLIC_WEB_URL}/unsubscribe?token={encodeURIComponent(signedToken)}`. The token is `base64url(JSON).base64url(HMAC-SHA256)` where JSON is `{"c":"<contactId>","w":"<workspaceId>"}` and optionally `"exp":<unix_seconds>`.

**API (no JWT):** `GET /unsubscribe?token=...` — verifies the token, sets contact to **UNSUBSCRIBED**, appends an `UnsubscribeEvent` row (idempotent if already unsubscribed). Returns `{ "ok": true, "alreadyUnsubscribed": boolean }`. Invalid/missing token → **400**.

**Template rendering:** `{{unsubscribeUrl}}` is injected server-side for real contacts (not forged from `sampleVariables`). If the rendered HTML or plain text does not contain that URL string, a minimal compliance footer with the link is appended (MailProvider unchanged).

**Web:** `apps/web` route `/unsubscribe` reads `token` from the query string, calls the API, and shows success, “already unsubscribed”, or an error.

## Inbound mail webhooks (delivery / bounces / complaints)

Public endpoints (no JWT). Authenticity: header **`X-Webhook-Secret`** must equal **`WEBHOOK_MAIL_SECRET`** (secret values are never logged).

| Route | Purpose |
| ----- | ------- |
| `POST /webhooks/mail/generic` | MVP JSON contract (curl, custom integrations) |
| `POST /webhooks/mail/sendgrid` | Thin adapter: SendGrid Event Webhook payload (array or one object) |

**Rate limit:** per-IP sliding window, default **120** requests/minute (`WEBHOOK_MAIL_MAX_PER_MINUTE_IP`). In-memory only — use a shared limiter (e.g. Redis) behind multiple API instances in production.

**Normalized event types:** `DELIVERED`, `BOUNCED`, `COMPLAINED`, `DEFERRED`. Each request is stored in **`WebhookEvent`** with `rawPayload`, idempotency on `idempotencyKey` = `{provider}:{providerEventId}` or `{provider}:sha256:{hash(body)}`.

**Suppression (MVP):** **`COMPLAINED`** or **`BOUNCED` with `bounceKind: HARD`** → `Contact.status = BOUNCED`. **`BOUNCED` + SOFT** (and **`UNKNOWN`**) → only `WebhookEvent` row + debug log; **no** automatic `BOUNCED` on the contact (retry-friendly).

**Correlation:** `MessageEvent` now has optional **`smtpMessageId`** (RFC Message-ID, normalized) and **`providerMessageId`**. On SMTP send, Nodemailer’s `messageId` is saved when available. Webhooks match `MessageEvent` by those fields when present; otherwise suppression falls back to **all contacts with the same email** (multi-workspace caveat in MVP).

**Generic JSON example:**

```json
{
  "type": "delivered | bounced | complained | deferred",
  "email": "user@example.com",
  "bounceKind": "hard | soft | unknown",
  "providerMessageId": "optional-provider-id",
  "smtpMessageId": "optional-rfc-message-id",
  "providerEventId": "optional-stable-id-for-idempotency",
  "occurredAt": "2025-01-01T00:00:00.000Z"
}
```

For **`bounced`**, set **`bounceKind": "hard"`** if you want the contact suppressed; omitting it maps to **`UNKNOWN`** (logged only).

**SendGrid:** point Event Webhook HTTP POST at `https://<api>/webhooks/mail/sendgrid`, same `X-Webhook-Secret`. Supported events: `delivered`, `deferred`, `bounce`, `dropped`, `spamreport`. Opens/clicks are ignored. Optional ECDSA verification: stub in `sendgrid-webhook.verifier.ts` + `SENDGRID_WEBHOOK_PUBLIC_KEY` (implement with SendGrid’s SDK or docs).

**Local curl (generic):**

```bash
curl -sS -X POST http://localhost:4000/webhooks/mail/generic \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_MAIL_SECRET" \
  -d '{"type":"delivered","email":"demo@saas.local"}'
```

**Production:** terminate TLS at your edge, set a long random `WEBHOOK_MAIL_SECRET`, restrict firewall to provider IPs if offered, and replace in-memory throttling with Redis if you run several API replicas.

## Email / Mail (dev)

| Variable       | Meaning |
| -------------- | ------- |
| `MAIL_MODE`    | `console` (default) — log only; `smtp` — send via Nodemailer |
| `MAIL_FROM`    | From address when using SMTP |
| `SMTP_HOST`    | e.g. `localhost` for MailHog |
| `SMTP_PORT`    | e.g. `1025` (MailHog SMTP) or `587` |
| `SMTP_USER`    | optional |
| `SMTP_PASS`    | optional |
| `SMTP_SECURE`  | `true` for TLS (465); usually `false` for MailHog |

**Console mode (default):** no extra setup. Watch the API terminal: each send logs recipient and subject.

**MailHog (optional):** run MailHog, set in `apps/api/.env`:

```env
MAIL_MODE=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
MAIL_FROM=test@example.com
```

Then test-send and send-now messages appear in the MailHog UI.

**Testing unsubscribe with MailHog:** set `UNSUBSCRIBE_SECRET`, `PUBLIC_WEB_URL=http://localhost:3000`, and the same mail vars as above. Send a test or campaign email, open it in MailHog, copy the unsubscribe URL (or open it if your client resolves `localhost`). The browser should hit the Next.js `/unsubscribe` page, which calls `GET {NEXT_PUBLIC_API_URL}/unsubscribe?token=...`; the contact becomes **UNSUBSCRIBED** in the DB.

## BullMQ worker (campaigns + sequences)

Redis must be running (`docker compose up -d` includes Redis on `6379`).

One worker process (`npm run worker` / `worker:dev`) runs **two** BullMQ workers: queue **`campaign-send`** (campaign dispatch + scheduled campaign start) and queue **`sequence-dispatch`** (sequence steps).

| Variable | Meaning |
| -------- | ------- |
| `REDIS_URL` | e.g. `redis://localhost:6379` |
| `CAMPAIGN_BATCH_SIZE` | Contacts per DB batch (default `25`) |
| `CAMPAIGN_WORKSPACE_EMAILS_PER_MINUTE` | Max sends per workspace per minute via Redis counter (default `120`; **shared** with sequence sends) |
| `CAMPAIGN_MESSAGE_MAX_RETRIES` | Retries per recipient on transient SMTP errors (default `3`) |
| `CAMPAIGN_MESSAGE_RETRY_BASE_MS` | Base backoff ms, doubled each retry (default `2000`) |
| `CAMPAIGN_WORKER_CONCURRENCY` | Parallel **campaign** jobs (default `2`) |
| `CAMPAIGN_WORKER_GLOBAL_JOBS_PER_SEC` | Campaign worker limiter (default `20`) |
| `SEQUENCE_WORKER_CONCURRENCY` | Parallel **sequence** jobs (default `3`) |
| `SEQUENCE_WORKER_GLOBAL_JOBS_PER_SEC` | Sequence worker limiter (default `30`) |

**Run the API and the worker in separate terminals** (same `.env` / `DATABASE_URL` / mail settings as the API):

```bash
# Terminal 1 — API
npm run dev --workspace @email-saas/api

# Terminal 2 — worker
npm run dev:worker
# or: npm run worker:dev --workspace @email-saas/api
```

One command for API + web + worker from repo root:

```bash
npm run dev:apps:with-worker
```

After code changes, rebuild before `worker` if you use `node dist/...`:

```bash
npm run build --workspace @email-saas/api && npm run worker --workspace @email-saas/api
```

**MailHog E2E:** start MailHog, set `MAIL_MODE=smtp` and SMTP to MailHog, start Redis, API, and worker, then **Send now** on a campaign and watch MailHog; API logs show dev mail if `MAIL_MODE=console`.

**Sequences E2E (3 steps, 1 contact):** create 3 templates (or reuse one). **Sequences → New sequence** — e.g. step orders `1,2,3` with `delayMinutes` `0`, `1`, `1` (minutes) for quick testing. **Activate**, copy a **SUBSCRIBED** contact id from **Contacts**, **Enroll**. With **`npm run dev:worker`** (or `dev:apps:with-worker`), watch MailHog: three messages arrive with gaps ~1 min (tune delays as needed). Unsubscribe link or **hard bounce** webhook should **cancel** the enrollment and stop remaining steps.

## Testing templates, campaigns & sequences in the UI

1. Log in → **Dashboard**.
2. **Templates** → create a template (use `{{firstName}}`, `{{email}}` in HTML/subject).
3. On template **Edit**, use **Test send** (your mailbox or MailHog); optional JSON overrides for variables.
4. **Contacts** — ensure you have **SUBSCRIBED** contacts (import CSV or register path); adjust tags if you use tag filter.
5. **Campaigns** → **New campaign** — pick template, optional audience `query` / `tag`.
6. Open the campaign → check **Subscribed contacts matching filter** and **Message events** counters.
7. Start the **worker** (`npm run dev:worker` or `dev:apps:with-worker`) — required for campaigns **and** sequences.
8. **Send now** — UI shows **Queued**; status becomes **SENDING** with **Progress** and **job** state polled from `GET .../send-status` until **SENT** or **FAILED**; **Message events** update live (console or MailHog for delivery).
9. **Sequences** → **New sequence** → define steps → **Activate** → paste contact id(s) under **Enroll** → confirm emails in MailHog and **Enrollments** / recent events on the sequence detail page.

## CSV import format

Header row required. **Email** column is required (aliases: `email`, `e-mail`, `mail`).

Optional columns (aliases shown):

| Field     | Example columns                          |
| --------- | ---------------------------------------- |
| email     | `email`                                  |
| firstName | `first_name`, `firstName`, `first`       |
| lastName  | `last_name`, `lastName`, `last`         |
| company   | `company`, `organization`, `org`         |
| phone     | `phone`, `telephone`, `mobile`           |
| tags      | `tags`, `tag`, `labels` (comma-separated) |

Example `contacts.csv`:

```csv
email,first_name,last_name,company,tags
alice@example.com,Alice,Smith,Acme,"newsletter,vip"
bob@example.com,Bob,,,"beta"
```

Emails are normalized to lowercase. Duplicate emails in the same file after the first occurrence are **skipped**. Existing workspace contacts are **updated** when a column is present in the CSV and values change.

## Testing contacts in the UI

1. Log in at `/login` (or register).
2. Open `/dashboard/contacts`.
3. Upload a CSV with the `file` field (use the example above).
4. Use search, tag filter, pagination, **Save tags**, and **Unsubscribe**.

## Project structure

```text
.
├─ apps
│  ├─ api
│  │  ├─ prisma
│  │  │  ├─ migrations
│  │  │  ├─ schema.prisma
│  │  │  └─ seed.ts
│  │  └─ src
│  │     ├─ auth
│  │     ├─ campaign-send
│  │     ├─ campaigns
│  │     ├─ contacts
│  │     ├─ common
│  │     ├─ filters
│  │     ├─ mail
│  │     ├─ templates
│  │     ├─ app.module.ts
│  │     ├─ health.controller.ts
│  │     ├─ main.ts
│  │     └─ prisma.service.ts
│  └─ web
│     └─ src
│        ├─ app
│        │  ├─ dashboard
│        │  │  ├─ campaigns
│        │  │  ├─ contacts
│        │  │  └─ templates
│        │  ├─ login
│        │  └─ register
│        └─ components
├─ packages
│  └─ shared
│     └─ src
├─ docker-compose.yml
└─ package.json
```

## Next stage (not in this MVP)

- refresh tokens and secure HTTP-only cookies
- workspaces/invites/roles UI
- scheduled sends, multi-step flows, dead-letter handling
- richer analytics on MessageEvent
- tests (unit/e2e) and CI pipeline
