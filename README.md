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
- Private MCN creator records; no brand-facing creator directory or direct creator sourcing
- Blind campaign Q&A relayed through the platform
- Versioned content review and publication verification
- Request/approval/bank-transfer settlement workflow
- English, Korean, and Chinese locale-ready user data

## Creator directory visibility

Brands work with Futures through campaigns. Creator search, similar-creator and
related-brand recommendations, and creator collections are hidden; legacy page
URLs retain membership checks and redirect approved brands to campaign management.
All search design variants are closed. Directory preview, search, collection and
creator-image endpoints return a no-store 404. Brand bootstrap never queries the
creator directory, collections or search history and returns empty legacy fields.
Agency creator-project navigation is hidden, including direct section selection.
Existing private agency records and campaign collaboration data remain intact.
The legacy brand supplier-application read and decision endpoint also returns
404. Supplier applications and bids are internal sourcing records, not the
Futures-published proposal a brand will review.

## Public landing page

Both apps load Pretendard's pinned dynamic subset from their root layout through
`@futures-medialab/ui/pretendard-font`. Shared CSS defines `--fm-font-family`
and Tailwind's `font-sans`; public, auth, workspace, portal, archived and admin
UI use that same stack. Page providers must not load the font again.

`/` and `/landing` share the current Montage public home and locale handling. The previous main remains available at `/test` with noindex.

`/backup` preserves the public home as it appeared at commit `09176d6`
(2026-10-31). It has independent landing copy, styles, components and image
assets under `app/backup` and `public/backup-assets`, plus `noindex, nofollow`.
The archived CSS uses the `fmb-` prefix to avoid collisions with future landing
styles. Shared branding, language controls and locale resolution remain shared.
The public-home design and implementation scope are documented in
`docs/design/public-home-redesign.md` (the earlier plan remains as a historical reference).

The public home follows the archived landing's sequence and visual richness,
rebuilt with the service's Montage provider, Pretendard and Wanted blue (`#0066FF`).
It includes a blue hero illustration, buyer/supplier entry points, fictional campaign
concepts with genre tabs and accessible detail modals, a three-step workflow, partner
panels, FAQs, a final CTA and contact placeholders. Real campaigns, creator profiles,
prices and unverified client results remain outside the public home. The archived
page and its assets are independent and unchanged by this redesign.

- Components, styles and Korean/English/Chinese copy: `apps/platform/app/_components/public-home/`.
- Locale priority: `?lang=en|ko|zh`, saved language cookie, browser language,
  then English. Language changes preserve the current route and query parameters.
- Contact values remain explicit placeholders until real email/WeChat details are supplied.
- `/register?audience=buyer` offers Brand and Advertising Agency (Buyer).
  `/register/client-agency` stores a `BRAND` organization with
  `metadata.organizationType=client_agency`, sharing Buyer Core permissions.
  `/register/agency` remains the supplier MCN/agency/studio path.
- Public signup always creates a `PENDING` organization. Completed pending buyer
  profiles reach `/account`; workspace pages and APIs require `ACTIVE` status.
  The server-managed approved-test exception still requires an active organization.
- Registration boundary tests: `node --experimental-strip-types --test apps/platform/scripts/registration-input.test.mjs`.
  `scripts/buyer-registration-smoke.mjs` (platform working directory) uses a local
  server and one disposable database account to verify saved roles, approval gates
  and supplier isolation, then cleans up its own fixture.
- `/login` authenticates email/password accounts through Better Auth and the
  project's Neon PostgreSQL database. Passwords are hashed, not stored as text.
  Login and registration share the responsive Montage auth layout and workspace
  theme provider, with Pretendard, Wanted blue, localized errors and password
  visibility. Onboarding retains its separate layout.
- `/register` offers Brand, Advertising Agency (Buyer), and Creator Partner registration paths.
  `/register/agency` collects organization type; the buyer forms collect
  company size. All provide localized form validation, password confirmation,
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
- The workspace includes official projects, invitation status
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
from development. The platform accepts same-origin browser requests on both
`https://futures-medialab.vercel.app` and `https://www.futuresmedia.app`. Local
and preview servers use their configured origin. Secrets and pulled environment files must never be committed.
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
  approved partners. Workspace access requires ACTIVE status and a completed
  company profile. Campaign submission also requires OWNER/ADMIN membership.
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
owner with an incomplete profile goes to onboarding; an approved, completed buyer goes to
`/advertiser`. Agency/studio accounts continue to onboarding, verification
status or `/agency`, according to their stored organization state. Suspended brands
cannot enter the workspace or mutate its data.

| Route                           | Implemented scope                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/advertiser` | Organization campaign totals, active campaigns, request status and managed/open intake entry points |
| `/advertiser/campaign` | Real campaign list, status filters and title/brief search |
| `/advertiser/campaign/new` | Brief, composition preference and managed/open request; partial drafts and versioned draft editing |
| `/advertiser/campaign/[id]` | Saved brief, published official proposals, versioned production review, and operator-published posting/performance reports; documents remain pending |
| `/advertiser/library` | Campaign document entry points; empty until brand-facing documents are published |
| `/storage/search` and all variants | Retired; approved brands redirect to campaign management |
| `/storage/similar-search` and `/storage/similar-brands` | Retired recommendations; same redirect |
| `/storage/collect` | Retired creator collections; same redirect |
| `/shortLinks`                   | Legacy direct route: HTTPS short links, copy/pause, raw redirect-request counts; outside the brand sidebar |
| `/agent`                        | Legacy direct route: persisted analysis-request intake and history; outside the brand sidebar |
| `/advertiser/requests`          | Organization request inbox, public replies, private attachments, status/history and reopening |
| `/advertiser/accountManagement` | Contact/company edits and read-only account/security information                               |

The brand workspace implementation and agency workspace share the Montage header,
monochrome sidebar, Pretendard typography and Wanted-blue theme through
`app/_components/workspace`. Navigation keeps role-specific routes, current-page
selection, the current path/query when changing language, and mobile Escape/focus
behavior. Creator discovery menus and agency creator-project navigation are hidden.
The earlier search comparison components remain in source for reference, but their
page routes no longer render them. Landing and onboarding keep their existing layouts.

The brand sidebar is Home, Campaigns, Requests and Library, with Account in the
shared account controls. The approved `/brand-preview` remains an isolated visual
prototype; authenticated `/advertiser/*` pages do not import its example campaigns,
creator identities, prices or results. They use installed Montage 4.1.5 components
and semantic tokens, following the supplied Wanted Figma system. The design and
remaining workflow scope are recorded in [the brand workspace plan](docs/design/brand-workspace-plan.md).

Live campaign intake reuses `Campaign` and `WorkspaceToolRequest` without a new
migration. Saving a draft requires only a title. Submission validates the full
brief, records the composition preference, and creates a linked request atomically.
Managed intake records a proposal deadline 48 calendar hours after completed
submission. Open intake requires a recruiting deadline before the target publication
date and does not receive the managed 48-hour deadline. These are operating
schedules, not an automatic proposal-generation engine.
If an operator returns a request for changes, explicit resubmission updates the
existing intake with version/audit history and restarts the managed deadline from
that resubmission; it does not create a second campaign or duplicate intake.

Official proposals now use separate `CampaignProposal`, `ProposalItem`,
`ProposalDecision` and `ProposalMutation` models. Operators create a private draft,
save its creator snapshots and commercial terms, preview the brand-visible fields,
then explicitly publish an immutable version. Brands receive only published
versions belonging to their organization; draft identities, private creator IDs,
supplier identities/costs and internal notes never appear in the public DTO.
Brand owners/admins approve selected pending items or request changes with a reason.
All-item approval moves the campaign to `IN_PROGRESS`; a new published version
supersedes the previous one. Expired/replaced versions and ended campaigns reject
new decisions. Live session/role rechecks, optimistic revisions, idempotency keys
and transaction-scoped audit records protect each write. Publication and decisions
also update the campaign-linked intake thread without sending external messages.

`GET/POST /api/admin/proposals` handles the operator workflow;
`POST /api/brand/proposals` records item decisions. The existing brand workspace
and campaign APIs include published proposal summaries and details. Apply
`20261102000000_add_official_proposals` before deploying either app.

Brand production reviews use `ProductionItem`, `ProductionSubmission` and
`ProductionMutation`. Full approval of the current official proposal creates
production assignments without accepting a supplier application or signing a
contract. Agencies submit versioned HTTPS references and notes; operators review
the private source and either request revisions or explicitly release a separate
brand-visible snapshot. Brand owners/admins approve that exact released version
or request changes. Every resubmission goes through operator review again.
Unreleased sources, supplier details and internal notes never enter brand DTOs.
`GET/POST /api/{agency,admin,brand}/production` enforce session/tenant/role checks,
optimistic revisions and idempotency. Legacy content submission/review writes are
blocked for campaigns using official proposals. Apply
`20261102010000_add_production_review` before deploying the updated apps.

Posting and performance reports use `ReportingItem`, `ReportingSubmission` and
`ReportingMutation`. Brand content approval prepares the reporting task; agencies
register a posted HTTPS link, publication/measurement times and nullable metrics.
Operators request revisions or explicitly release a separate public snapshot.
Updates require review again and preserve the previous brand-visible version.
`GET/POST /api/{agency,admin}/reporting` and read-only `GET /api/brand/reporting`
enforce the same organization, session, revision and idempotency boundaries.
Zero and unknown metrics remain distinct; totals use each item's latest public
snapshot once, and reach is not summed. Apply `20261102020000_add_post_reporting`
before deployment. The [NTE reporting demo](docs/design/nte-reporting-demo.md)
adds six marked scenarios with official reference links and fictional metrics.

Campaign completion and finance use `CampaignCompletion`, `BrandInvoice`,
`AgencyPayout` and `SettlementMutation`. Operators verify the latest approved
proposal/content, published reports and confirmed economics before completion.
They prepare private drafts, issue brand invoices and agency payouts separately,
then record external payment outcomes. Amounts and issued snapshots are immutable;
no transfer or payment is executed. Recipient APIs expose only that organization's
issued/paid documents. Apply `20261102030000_add_official_settlement` before
deployment. See the [NTE completion and settlement demo](docs/design/nte-settlement-demo.md)
for four real-DB scenarios and the verified Futures Entertainment channel references.

`campaignPerformance` is enabled. General brand-library documents still have no
dedicated publication model and their capability remains false; issued invoices
are available separately under Billing.
The three composition cards save a preference; they do not calculate an anonymous
lineup, price or projected reach. Supplier applications, submissions, contracts and
settlements are never substituted for brand-facing artifacts. Proposal approval
does not sign a supplier contract or execute payment.

The optional [NTE demo walkthrough](docs/design/nte-proposal-demo.md) uses the
three explicitly authorized existing test accounts and four marked campaigns.
Run the seed in read-only mode first; `--apply` adds the exact fixture set without
resetting existing credentials, roles or subsequent demo decisions:

```bash
node --experimental-strip-types apps/platform/scripts/seed-nte-proposals.mjs
node --experimental-strip-types apps/platform/scripts/seed-nte-proposals.mjs --apply
```

The [NTE production walkthrough](docs/design/nte-production-demo.md) extends these
accounts with six persisted production scenarios and official game artwork. It
preserves existing proposal decisions and reuses the three fictional creators:

```bash
node --experimental-strip-types apps/platform/scripts/seed-nte-production.mjs
node --experimental-strip-types apps/platform/scripts/seed-nte-production.mjs --apply
```

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

The directory retains **60 fictional demo profiles** with example.com identifiers.
An explicit internal-demo import additionally publishes **9 Korean gaming YouTube
channel identities and official channel avatars**, three each for Lineage,
MapleStory and Lost Ark. Each channel has two verified game-video references;
the game tags support quick filtering in both Montage views. Their follower counts, views,
engagement, posting recency and audience breakdowns remain synthetic. No real
endorsements or video titles are invented. Channel identity and video ownership
are checked against official YouTube pages; identities are not copied to other platforms. The source URLs, channel
verification evidence and image provenance are recorded in
`apps/platform/scripts/fixtures/korean-creators.sources.json`.

Search and recommendation algorithms remain in source for internal reference.
No brand, guest or approved test account can query the directory through the
partner platform. Previously stored directory records and history are retained
in the database but are not returned by the brand APIs.

Creator portrait assets remain in private Blob storage for maintenance. The former
public `/api/creator-images/{id}/{sha256}` endpoint is now disabled with a no-store
404. Previously downloaded or optimized public images may remain cached; hiding
these routes cannot recall copies already obtained by clients.

Maintenance (from the repository root; not invoked by startup or request handlers):

```sh
node apps/platform/scripts/seed-korean-creators.mjs             # validate sources; no DB/Blob access
node apps/platform/scripts/seed-korean-creators.mjs --prepare   # download verified avatars and prepare local WebP/manifest
node apps/platform/scripts/seed-korean-creators.mjs --apply     # upsert reviewed demos/Blob assets and unpublish explicitly retired demo IDs
```

`--apply` uses the ignored `apps/platform/.env.local` by default (override with
`--env-file`). It refuses non-demo ID collisions and never deletes existing entries.
The earlier 10 unrelated public-channel demos are unpublished using the explicit
`korean-creators.retired.json` ID list. Fictional fixtures and private creator records
are preserved; retired Blob objects remain private and are removed from the public
image manifest.
Profile images are official public-channel references for the requested internal
demo; the provenance file does not assert a verified reuse license.

Analysis tools only save `REQUESTED` records; there is no background worker,
external data collection, LLM execution, automatic report, or promised SLA.
Campaign `REVIEW` is an intake status, not automatic approval/publication/payment.
Short-link counts are raw GET requests (including bots/repeats), not unique
visitors or conversions; HEAD requests do not count. Link targets are validated
public HTTPS addresses and are never fetched by the server.

### Workspace API and security

- `GET /api/workspace/bootstrap`: allowlisted, organization-scoped DTOs.
- `GET /api/brand/workspace`: organization-scoped account/permissions, recent
  campaigns and requests, full status totals and explicit workflow capabilities.
- `GET /api/brand/campaigns/[id]`: own-campaign detail and linked requests;
  cross-organization IDs return 404. Raw supplier applications are not queried.
- `POST /api/brand/campaigns`: create, `saveDraft`, `submitDraft` and `cancel`.
  UUID request keys make intake retries idempotent; draft updates/submission and
  cancellation use optimistic timestamps. Direct cancellation is limited to
  drafts/review before an operator begins handling the linked request; it closes
  an unhandled intake and clears its due date atomically.
- `/api/directory/preview`, `/api/workspace/search`, `/api/workspace/collections`,
  `/api/creator-images/*`, `GET|POST /api/workspace/campaign-applications`:
  retired, no-store 404; no directory or supplier application access.
- `POST /api/workspace/links`, `/campaigns`, `/tools`, `/account`:
  explicit action/body contracts; the client never supplies an organization ID.
- Active workspace routes recheck the database session, membership, completed profile (or an
  explicitly approved test-organization exemption) and
  suspension status. Mutations require exact trusted Origin, valid JSON,
  bounded bodies (16KiB) and strict schemas. Serializable writes protect state.
- OWNER/ADMIN can manage links and campaigns; only OWNER can update company
  identity. Members can read their organization's campaigns and use permitted
  request functions; directory search and shared creator collections are retired
  for every role.
- Shared database-backed per-user limits: reads 120/min, writes 60/min, searches
  30/min (also counted as writes). Bounded collections/links/campaigns/requests
  prevent unlimited growth. Private responses are `no-store`.
- `/s/[code]` is deliberately public, checks link/organization status, and uses
  unguessable codes. No contact details or private creator roster is returned.

Brand endpoint and visibility regression tests (no database connection):

```sh
node --test apps/platform/scripts/brand-workspace.test.mjs apps/platform/scripts/creator-visibility.test.mjs
```

Opt-in live-data integration check against a running local platform server and its
matching ignored environment file (creates and removes exact synthetic QA fixtures):

```sh
BETTER_AUTH_URL=http://127.0.0.1:3100 node apps/platform/scripts/brand-workspace-smoke.mjs --base-url http://127.0.0.1:3100 --env-file apps/platform/.env.local
```

This suite is restricted to localhost. It checks tenant/role boundaries, partial
drafts, managed/open intake, persistence, duplicate retries, optimistic conflicts
and cancellation. Its optional browser-fixture mode deliberately retains the exact
QA records for UI verification and requires the matching cleanup command afterward.

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

The existing shared Prisma models support open recruitment without a new migration:

`Brand DRAFT → REVIEW → operator publication → RECRUITING → agency application → internal operations`

- For open recruitment, the brand supplies a public title/brief, platforms, regions, categories,
  follower range, currency, budget and application deadline. Publishing requires
  an ACTIVE brand, positive budget and future deadline. Keep identifying/contact
  information out of the public brief if the campaign should remain blind.
- Managed operator approval also uses the existing `RECRUITING` database enum,
  but means **internal sourcing**, shown as `소싱 중` with an `승인·소싱 시작`
  action. It requires a future target publication date, not an application
  deadline. Completing sourcing moves the campaign to `IN_PROGRESS`. Managed
  records are excluded from both the agency campaign list and direct application
  API regardless of any legacy recruitment deadline. Open `RECRUITING` retains
  its public recruitment meaning and future application-deadline requirement.
- The agency API only returns published, recruiting, unexpired campaigns from
  active brands. Brand identity/private fields are omitted. Applications are
  unique per campaign/agency and use the campaign currency. Each agency sees only
  its own applications. Brands cannot read supplier application text or bids,
  even for their own campaigns. Operators can inspect these internal records
  separately. Managed campaigns use a separate sourcing/intake route rather than
  inheriting the open marketplace's recruiting deadline or publication behavior.
- OWNER/ADMIN may submit or withdraw an application; MEMBER is read-only.
  Withdrawal is allowed only before acceptance/rejection. A withdrawn application
  cannot currently be re-submitted. Direct brand shortlist/accept/reject actions
  are retired; future brand decisions must target an operator-published official
  proposal. Existing accepted supplier records remain available to the internal
  production/contract/settlement workflow; acceptance alone does not execute a
  contract or create a settlement.
- `GET /api/agency/campaigns`, `POST /api/agency/applications` and
  active brand intake APIs enforce fresh DB membership,
  sessions, approval, strict body validation, origin checks and rate limits.
  Serializable writes and the unique key protect concurrent submissions.
  `GET|POST /api/workspace/campaign-applications` returns 404 for anonymous,
  same-brand and cross-brand requests without reading or mutating applications.
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
and campaigns, explicitly marks each exact owned legacy-created draft as
`OPEN_BIDDING`, and checks open publication, supplier application/withdrawal, operator
closure and security boundaries, including retired brand decisions leaving the
database unchanged. An accepted application is explicit fixture setup solely to
verify that agency withdrawal remains blocked; it does not test a new proposal
publication or brand approval workflow. The suite
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

### Open campaign creator applications

Approved supplier organizations register their own creator roster and submit one or
more creator/channel/format rows from the offer board. Drafts, quantities, supply
rates and availability are persisted. The server derives supplier identity and
currency, verifies roster ownership and recruitment conditions, calculates totals
in integer cents, and makes repeated submissions idempotent.

Operators review individual rows in sourcing, then select the reviewed row in the
official proposal editor. Proposal versions retain the row association. The
supplier workspace derives approval-pending, confirmed, partially confirmed,
rejected and expired states from the current published version. Brand responses
omit supplier identities, original applications, row identifiers and supply costs.
Published rows cannot be withdrawn or reassigned through recruitment controls.

Supplier-facing campaign responses exclude the brand budget. Operators can set an
independent per-item supplier rate ceiling under recruitment conditions; changes
apply to later submissions, not to previously submitted terms. Unset ceilings are
negotiable. Private invitations and the partner inquiry preview remain marked as
previews and are separate from the persisted open-application workflow.

Before deploying either app, apply
`20261108000000_open_campaign_applications` after
`20261107050000_proposal_channel_thumbnails` and regenerate the Prisma client.
The migration is additive and retains existing applications and proposal versions.
Existing applications without creator rows remain accessible in earlier records.

Regression coverage:

```bash
node --experimental-strip-types --test apps/platform/scripts/partner-applications.test.mjs apps/admin/scripts/sourcing.test.mjs packages/database/tests/proposals.test.mjs
```
