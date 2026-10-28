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

`/` directly re-exports `/landing`, so both use the same current design and
locale handling. The previous main remains available at `/test` with noindex.

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
- Brand campaign drafts, operations review, publication and agency applications
  persist in the database. Contract execution and settlement remain separate work.
  Google OAuth, email verification and password recovery
  are not enabled. Confirmed legal/privacy policies, verification emails and
  account recovery must be prepared before a broad public launch.
- `/test` preserves the prior `LandingPage` implementation for comparison and is
  excluded from indexing. Its brief builder remains local-only.

## Agency / Studio onboarding and workspace

- Agency owners continue to `/onboarding/agency` after registration/login.
  Drafts persist on the owned organization. Company information includes country,
  registered address, establishment date, contact method, business scope and
  platform contact. A business license ID is mandatory for Agency, optional for
  Studio. Both require a business proof document; a contract is optional.
- Proof and contract uploads use the **private** Vercel Blob store
  `futures-medialab-documents` in Singapore. Development and Production are
  connected; Preview is intentionally not connected. Pull development variables
  without overwriting local auth settings. `BLOB_READ_WRITE_TOKEN` is server-only.
- PDF, JPEG and PNG uploads are limited to 20 MB, go directly to Blob with a
  pathname-scoped short-lived token, and require authenticated server completion.
  The server checks ownership, stored metadata and file signatures before marking
  a document uploaded. This is format validation, not malware scanning. Download
  routes recheck organization ownership and stream attachments with no-store.
- Submission locks the profile and displays **Waiting for Verification**.
  It does not change the organization from PENDING to ACTIVE or verify email.
  Email delivery remains separate work; operations review is available in `apps/admin`.
- `/agency` shows real published campaigns to approved agencies, with grid/list
  views, platform/region/category/follower/budget/deadline filters, a proposal
  form and persisted application history. Pending organizations cannot access
  live campaigns. Application history is separate from accepted projects.
- `GET /api/agency/operations` reads only the approved session organization's
  accepted projects, linked creators, latest submission versions, settlements,
  sanitized profile and recent activity derived from current records. It is not
  a complete notification/event history. Result limits are displayed in the UI;
  demo records remain isolated and are excluded from financial totals.
- The workspace includes official projects, creator projects, invitation status
  tabs, settlement tabs, organization details and recent activity. Direct
  invitations, creator task assignment, content submission and withdrawals are
  not connected; their limitations are explicit rather than simulated.
- Read-only operations boundary tests:
  `node apps/platform/scripts/agency-operations.test.mjs` (mocked DB/auth).
- `pnpm --filter @futures-medialab/platform test:agency` checks the local
  onboarding/API/private-Blob path with synthetic accounts/files and cleans up
  only those fixtures. Start the app at port 3002 with matching BETTER_AUTH_URL.

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
`/storage/search`. Agency/studio accounts continue to onboarding, verification
status or `/agency`, according to their stored organization state. Suspended brands
cannot enter the workspace or mutate its data.

| Route                           | Implemented scope                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/storage/search`               | Six-platform directory, content/channel/audience filters, sorting, pagination, profile preview |
| `/storage/search/tds`           | Toss-blue visual variant with quick filters, card/list views, and the same authenticated directory APIs |
| `/storage/similar-search`       | YouTube/TikTok stored-channel similarity using shared topics                                   |
| `/storage/similar-brands`       | Stored sample-brand recommendations with publishing-platform filters                           |
| `/storage/collect`              | Organization collections, saved creators, CSV export                                           |
| `/shortLinks`                   | HTTPS short links, copy/pause, raw redirect-request counts                                     |
| `/agent`                        | Three analysis-request types, persisted intake and request history                             |
| `/advertiser/campaign`          | Drafts/editing, review submission, applications, shortlist/accept/reject                       |
| `/advertiser/requests`          | Organization request inbox, public replies, private attachments, status/history and reopening |
| `/advertiser/accountManagement` | Contact/company edits and read-only account/security information                               |

All views use the shared indigo workspace shell, custom selection controls,
English/Korean/Chinese labels, and 14px minimum text. Reference inspection used
Youdao's logged-in pages at the corresponding paths. Reference collection and
short-link creation were membership-gated; reference campaign management exposed
only managed-service/contact information. No paid analysis/search quota was used.

The `/storage/search/tds` comparison view uses an independently implemented
TDS-inspired presentation with `#3182F6` as its brand accent; it does not include
TDS packages, restricted fonts, or Toss brand assets. Its CSS is scoped to that
view. Authentication, demo-data labels, search history, collections, and profile
details reuse the existing workspace behavior. Language changes stay on the
comparison route, and “Original view” returns to `/storage/search`.

### Request handling and campaign operations

The admin console's request inbox handles both new brand support requests and
existing analysis requests in `WorkspaceToolRequest`. Administrators can assign
an active operator, set priority/deadline, reply publicly, add private internal
notes, and resolve/close requests. Brands only see their organization's public
conversation; resolved requests can be reopened, but closed requests are final.
Changes use optimistic versions, session/organization rechecks and audit records.

Attachments use the existing private Blob store (`BLOB_READ_WRITE_TOKEN` in both
apps), accept PDF/PNG/JPEG up to 4 MB each and five files per reply. Downloads
are authenticated; neither Blob URLs nor tokens are returned to clients.
Unsent uploads are restored after refresh and can be cancelled. Cancellation
marks the record discarded before deleting the Blob, so it cannot be attached
by a concurrent reply. Failed storage cleanup can be retried with the same
authenticated DELETE. Cancelled files cannot be recovered through the workspace.

For accepted agency applications, the admin campaign detail now includes draft
review/revision, published-link verification, external contract reference records,
and settlement preparation/review. Agency projects support versioned HTTPS draft
and publication links. Settlement amounts are computed on the server and checked
against the proposal, currency and campaign-wide budget. Approval requires the
latest verified content and a confirmed contract reference. This does **not**
perform electronic signing, automated analysis, email delivery or money transfers;
settlements are never marked `PAID` by these endpoints.

Apply migrations before running the updated apps. Restart long-running `next dev`
processes after changing/regenerating Prisma models to replace cached clients.
Regression tests: `node --experimental-strip-types --test apps/admin/scripts/*.test.mjs apps/platform/scripts/*.test.mjs`.
Opt-in real-DB checks (local servers on 3000/3001, DB credentials supplied by the
caller): `RUN_DB_SMOKE=1 node apps/platform/scripts/requests-smoke.mjs` and
`RUN_DB_SMOKE=1 node apps/platform/scripts/campaign-operations-smoke.mjs`.
Both create isolated, temporary fixtures and remove only their own records.

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
- All routes recheck the database session, membership, completed profile (or an
  explicitly approved test-organization exemption) and
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

### Approved test organizations

An operator may explicitly grant an organization `metadata.testWorkspaceAccess: true`
alongside `status: ACTIVE` for user-requested workspace testing. Both are required;
the flag never bypasses authentication, organization membership, roles, or suspension.
It skips company onboarding without fabricating company information, uploaded proof,
submission timestamps, or email verification. Public registration and profile/account
APIs cannot set this server-managed flag. Removing the flag restores normal onboarding.
This is approved workspace access, not an isolated sandbox: existing workspace actions
remain subject to their normal permissions. Do not enable this on ordinary signups.

```bash
node --experimental-strip-types --test apps/platform/scripts/test-workspace-access.test.mjs
```

## Live campaign marketplace and operations console

The existing shared Prisma models support the flow without a new migration:

`Brand DRAFT → REVIEW → admin RECRUITING → agency application → brand decision`

- The brand supplies a public title/brief, platforms, regions, categories,
  follower range, currency, budget and application deadline. Publishing requires
  an ACTIVE brand, positive budget and future deadline. Keep identifying/contact
  information out of the public brief if the campaign should remain blind.
- The agency API only returns published, recruiting, unexpired campaigns from
  active brands. Brand identity/private fields are omitted. Applications are
  unique per campaign/agency and use the campaign currency. Each agency sees only
  its own applications; brands see only their campaigns' applications with opaque
  partner labels. Operators can inspect full organization details separately.
- OWNER/ADMIN may submit or withdraw an application; MEMBER is read-only.
  Withdrawal is allowed only before acceptance/rejection. A withdrawn application
  cannot currently be re-submitted. Shortlist, accept and reject are persisted and
  audited. Acceptance does not execute a contract or create a settlement.
- `GET /api/agency/campaigns`, `POST /api/agency/applications` and
  `GET|POST /api/workspace/campaign-applications` enforce fresh DB membership,
  sessions, approval, strict body validation, origin checks and rate limits.
  Serializable writes and the unique key protect concurrent submissions.
- `apps/admin` is a separate Next.js app deployed to Vercel project
  `flamingcc/futures-medialab-admin`, root `apps/admin`. Only ACTIVE PLATFORM
  OWNER/ADMIN members can enter. It shares DB and private documents, not session
  cookies or authentication secrets. See [admin setup](apps/admin/README.md).
- Operations can review organization information/documents, approve/request
  corrections/suspend, publish/return/close campaigns and revoke normal user
  sessions. Reasons and audit logs are mandatory for changes. No public admin
  signup, automatic email-based privilege grants, payments or deletion UI exists.
- Email OTP/MFA is not connected. The operator-requested temporary admin password
  is stored only as a credential hash, not in source; replace it before broader use.

Validation and opt-in integration test (start both servers against the same DB;
run auth tests sequentially so their shared rate limit is respected):

```sh
node --experimental-strip-types --test apps/platform/scripts/campaign-validation.test.mjs apps/admin/scripts/verification.test.mjs
RUN_DB_SMOKE=1 BASE_URL=http://localhost:3000 ADMIN_BASE_URL=http://localhost:3001 node --env-file=.env.local apps/platform/scripts/campaign-marketplace-smoke.mjs
```

The integration suite creates uniquely identified synthetic accounts, organizations
and campaigns, checks the complete review/application path and security boundaries,
then deletes only its exact owned fixtures. It never resets shared authentication
counters or changes the real test accounts.

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
