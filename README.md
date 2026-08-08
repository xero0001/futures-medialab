# Futures Medialab

Monorepo for the Futures Medialab creator campaign platform.

## Workspace

- `apps/platform`: public website and partner platform
- `apps/admin`: internal operations console
- `packages/database`: Prisma schema and shared client
- `packages/ui`: shared React components and design tokens
- `packages/eslint-config`: shared ESLint configuration
- `packages/typescript-config`: shared TypeScript configuration

## Requirements

- Node.js 22 or later
- pnpm 10.22.0

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm dev
```

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
