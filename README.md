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
- Internal creator roster rather than a public creator directory
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
- `/login` provides a localized split-layout sign-in preview with email
  validation and a password visibility toggle. Authentication, Google OAuth,
  and password recovery are not connected. Credentials are not sent or stored.
- Locale resolution is shared by the landing and login pages in
  `apps/platform/lib/locale.ts`.
- Partner authentication, application intake, live campaigns, and settlement
  operations remain separate backend work.
- `/test` preserves the August 8, 2026 landing design from commit `d6bfb3e`
  for comparison. It is marked as an archived mockup and excluded from indexing;
  its illustrative numbers, original typography, and sample campaign UI remain.

## Requirements

- Node.js 22 or later
- pnpm 10.22.0

## Getting started

```bash
cp .env.example .env.local
pnpm install
pnpm db:generate
pnpm dev
```

For Vercel, connect a Marketplace Postgres resource to the project. Runtime
queries use `DATABASE_URL`; Prisma migrations prefer `DIRECT_URL` or
`DATABASE_URL_UNPOOLED` when the provider exposes one.

The platform runs on `http://localhost:3000` and the admin app runs on
`http://localhost:3001`.

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
