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
