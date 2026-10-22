# Futures Medialab

Monorepo for the Futures Medialab cross-border creator campaign platform.

## Workspace

- `apps/platform`: public website and partner platform
- `apps/admin`: internal operations console
- `packages/database`: Prisma schema and shared client
- `packages/ui`: shared React components and design tokens
- `packages/eslint-config`: shared ESLint configuration
- `packages/typescript-config`: shared TypeScript configuration

The workspace follows the same application/package boundary used by
DoctorNest: deployable products live in `apps/*`, while reusable domain,
database, UI, lint, and TypeScript code lives in `packages/*`.

## Product foundations

- Approved agency/MCN and brand organizations
- Open-bidding and managed campaigns sharing one campaign model
- Private MCN creator rosters, separate from the brand-facing published directory
- Blind campaign Q&A relayed through the platform
- Versioned content review and publication verification
- Request/approval/bank-transfer settlement workflow
- English, Korean, and Chinese locale-ready user data

## Public landing page

The home page presents managed campaigns and an approved-organization
marketplace, Korean localization, campaign delivery, and partner requirements.
Its content is based on the business proposal v2.0, the service proposal, and
Youdao Ads' public site. Internal revenue, speculative performance statistics,
customer logos, and unconfirmed pricing are not published.

- Copy: `apps/platform/app/_components/landing-copy.ts`
- Page components: `apps/platform/app/_components/`
- Scoped styles: `apps/platform/app/landing.css`
- Locale priority: `?lang=en|ko|zh`, saved language cookie, browser language,
  then English. Manual language changes update both the URL and cookie.
- The brief builder creates a downloadable text file in the browser. It does
  not submit campaign requests or store the form in a database.
- Five broad sections keep the page focused on the introduction, brand
  campaigns, MCN partners, workflow, and brief creation. All retained text is
  at least 14px; body text is 16–18px.
- `/login` authenticates email/password accounts through Better Auth and the
  project's Neon PostgreSQL database. Passwords are hashed, not stored as text.
- `/register` offers only Agency / Studio and Brand registration paths.
  `/register/agency` collects organization type; `/register/brand` collects
  company size. Both provide localized form validation, password confirmation,
  and a review before submission. Creator registration routes return 404;
  the API also rejects creator registrations. User, credential account,
  pending organization and owner membership are created in one transaction.
- `/account` validates the database session on the server and displays the
  user's organization and approval status. Logout revokes the database session.
  Registration is not organization approval or permission to access campaigns.
- Brands complete `/onboarding/brand` after signup: company information,
  industry, country/region, company size, contact person, optional phone, and
  first-visit marketing interests. The form uses custom selection controls.
  Completion is saved to the owned organization but does not approve it;
  both the organization and email remain pending/unverified respectively.
- Locale resolution is shared by the landing, login, and registration pages in
  `apps/platform/lib/locale.ts`.
- Brand campaign drafts and review requests persist in the database. Public
  campaign operations, approval tooling and settlement remain separate work.
  Google OAuth, email verification and password recovery
  are not enabled. Confirmed legal/privacy policies, verification emails and
  account recovery must be prepared before a broad public launch.
- `/test` preserves the August 8, 2026 landing design from commit `d6bfb3e`
  for comparison. It is marked as an archived mockup and excluded from indexing;
  its illustrative numbers, original typography, and sample campaign UI remain.

## Requirements

- Node.js 22 or later
- pnpm 10.22.0

## Getting started

```bash
pnpm install
vercel project inspect --scope flamingcc --non-interactive
vercel env pull apps/platform/.env.local --environment=development --scope flamingcc
pnpm db:generate
pnpm dev
```

For Vercel, connect a Marketplace Postgres resource to the project. Runtime
queries use `DATABASE_URL`; Prisma migrations prefer `DIRECT_URL` or
`DATABASE_URL_UNPOOLED` when the provider exposes one.

The linked project is `flamingcc/futures-medialab` (`apps/platform` as root).
Neon resource: `futures-medialab-db` (free plan, Singapore). Production uses
`BETTER_AUTH_URL=https://futures-medialab.vercel.app` and a separate auth secret
from development. Secrets and pulled environment files must never be committed.
Preview has no production database credentials; connect an isolated database
before testing authenticated preview deployments.

For a different local database, copy `.env.example` to
`apps/platform/.env.local`, replace the example PostgreSQL URLs and generate a
random `BETTER_AUTH_SECRET` (32+ characters). Use the same origin for the dev
server and `BETTER_AUTH_URL`; for port 3002, override it in the shell:

```bash
BETTER_AUTH_URL=http://localhost:3002 pnpm --filter @futures-medialab/platform exec next dev --port 3002
```

### Database migrations

Run additive migrations explicitly before deploying auth changes. Prisma CLI
does not automatically load the app's `.env.local`:

```bash
DOTENV_CONFIG_PATH=../../apps/platform/.env.local pnpm --filter @futures-medialab/database db:migrate:deploy
```

Check which database the environment targets before any migration. Do not use
`prisma migrate reset` or `db push --accept-data-loss` against a shared database.
The initial Marketplace connection shares the resource between Production and
Development; use a separate Neon branch for ongoing development. Test scripts
must delete only the exact disposable records they created.

### Authentication boundary

- `/api/auth/sign-up/organization`: server validation, same-origin protection,
  a transaction, and database-backed rate limiting.
- Built-in email-only signup is disabled, so organization registration cannot
  be bypassed. Clients cannot choose organization approval or membership roles.
- Better Auth handles password hashing, session cookies and session revocation.
  Sensitive auth cookies are HttpOnly, SameSite and Secure on production HTTPS.
- `PENDING` organizations can sign in and view account status, but are not
  approved partners. Completed brands can use the demo directory and prepare
  drafts. Campaign submission requires ACTIVE status and OWNER/ADMIN membership.
- Email ownership is not verified yet (`emailVerified=false`); do not use an
  unverified email domain to grant privileges or organization ownership.
- `/api/account/brand-profile` requires a same-origin request and a real
  authenticated brand-owner membership. Organization IDs, approval status and
  membership privileges are never accepted from the profile form.

### Authentication smoke test

With the dev server running on port 3002 against the same database:

```bash
BETTER_AUTH_URL=http://localhost:3002 pnpm --filter @futures-medialab/platform test:auth --base-url http://localhost:3002
```

The suite checks all partner roles, password hashing, duplicate and invalid
registrations, CSRF, sessions, logout/revocation, and database-backed rate
limits. It creates uniquely named `Auth QA` fixtures and deletes only their
exact IDs in `finally`. It waits for real rate-limit cooldowns instead of
bypassing them; do not run concurrent auth tests from the same client. Remote
tests require explicit `--allow-remote`, a matching `BETTER_AUTH_URL`, and the
same database environment as that deployment.

The platform runs on `http://localhost:3000` and the admin app runs on
`http://localhost:3001`.

## Brand workspace

After login `/auth/continue` resolves the destination on the server. A brand
owner with an incomplete profile goes to onboarding; a completed brand goes to
`/storage/search`. Agency/studio accounts stay on `/account`. Suspended brands
cannot enter the workspace or mutate its data.

| Route                           | Implemented scope                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/storage/search`               | Six-platform directory, content/channel/audience filters, sorting, pagination, profile preview |
| `/storage/similar-search`       | YouTube/TikTok stored-channel similarity using shared topics                                   |
| `/storage/similar-brands`       | Stored sample-brand recommendations with publishing-platform filters                           |
| `/storage/collect`              | Organization collections, saved creators, CSV export                                           |
| `/shortLinks`                   | HTTPS short links, copy/pause, raw redirect-request counts                                     |
| `/agent`                        | Three analysis-request types, persisted intake and request history                             |
| `/advertiser/campaign`          | Private drafts, approved-brand review submission, cancellation                                 |
| `/advertiser/accountManagement` | Contact/company edits and read-only account/security information                               |

All views use the shared indigo workspace shell, custom selection controls,
English/Korean/Chinese labels, and 14px minimum text. Reference inspection used
Youdao's logged-in pages at the corresponding paths. Reference collection and
short-link creation were membership-gated; reference campaign management exposed
only managed-service/contact information. No paid analysis/search quota was used.

### Data and provider boundary

`20261022120000_add_brand_workspace` adds `CreatorDirectoryEntry`,
`CreatorCollection`, `CreatorCollectionItem`, `DirectorySearch`, `ShortLink`,
and `WorkspaceToolRequest`. It reuses the existing `Campaign` and `Organization`
models. Directory entries contain indexed publication/platform flags and a
strictly validated JSON profile; they never expose private `CreatorProfile`
notes or MCN ownership. The database is not an external creator-data provider.

The initial directory contains **60 fictional, visibly labeled demo profiles**,
not scraped creator data. The example.com profile URLs are identifiers only.
Search and recommendation operate on published database entries; PENDING brands
can read only demo entries. Similarity is deterministic topic overlap, not AI.
The current UI is explicitly demo-labeled; update provenance presentation before
publishing non-demo provider records. Query history retains the latest 100 per
user/organization. A separate ingestion/admin workflow is still needed for real
verified creators, metric refresh, licensing and data provenance.

Analysis tools only save `REQUESTED` records; there is no background worker,
external data collection, LLM execution, automatic report, or promised SLA.
Campaign `REVIEW` is an intake status, not automatic approval/publication/payment.
Short-link counts are raw GET requests (including bots/repeats), not unique
visitors or conversions; HEAD requests do not count. Link targets are validated
public HTTPS addresses and are never fetched by the server.

### Workspace API and security

- `GET /api/workspace/bootstrap`: allowlisted, organization-scoped DTOs.
- `POST /api/workspace/search`: validated filters and persisted query history.
- `POST /api/workspace/collections`, `/links`, `/campaigns`, `/tools`, `/account`:
  explicit action/body contracts; the client never supplies an organization ID.
- All routes recheck the database session, membership, completed profile and
  suspension status. Mutations require exact trusted Origin, valid JSON,
  bounded bodies (16KiB) and strict schemas. Serializable writes protect state.
- OWNER/ADMIN can manage links and campaigns; only OWNER can update company
  identity. Members can search, manage shared collections and submit tool requests.
- Shared database-backed per-user limits: reads 120/min, writes 60/min, searches
  30/min (also counted as writes). Bounded collections/links/campaigns/requests
  prevent unlimited growth. Private responses are `no-store`.
- `/s/[code]` is deliberately public, checks link/organization status, and uses
  unguessable codes. No contact details or private creator roster is returned.

Explicit demo seed (never runs on requests/builds; no existing records deleted):

```bash
node --experimental-strip-types apps/platform/scripts/seed-creator-directory.mjs
node --experimental-strip-types apps/platform/scripts/seed-creator-directory.mjs --apply
node --experimental-strip-types --test apps/platform/scripts/creator-directory.test.mjs
BETTER_AUTH_URL=http://localhost:3002 node --experimental-strip-types apps/platform/scripts/workspace-smoke.mjs --base-url http://localhost:3002
```

Run auth and workspace smoke suites sequentially against the same server/DB.
They use synthetic fixtures and remove only those exact records. Before public
launch, separate development from production DB, add email verification/recovery,
configure real data/AI providers and operations workflows, and review privacy,
redirect abuse handling and retention policies.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm check-types
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
pnpm db:studio
```
