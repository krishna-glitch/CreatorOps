# CreatorOps

CreatorOps is a Next.js app for managing brand deals, deliverables, payments, reminders, and creator-side operations from one dashboard.

## Stack

- Next.js App Router
- TypeScript
- tRPC
- Drizzle ORM
- Supabase (Auth + Postgres)
- Upstash Redis / BullMQ (optional queue-based reminder worker)
- Resend (email reminders)
- Web Push notifications (VAPID)

## Local setup

1. Install dependencies:

```bash
npm ci
```

2. Copy environment template and fill in values:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Environment variables

Use `.env.example` as the source of truth. Main groups:

- Supabase:
`NEXT_PUBLIC_SUPABASE_URL`
`NEXT_PUBLIC_SUPABASE_ANON_KEY`
`SUPABASE_SERVICE_ROLE_KEY`
- Database:
`DATABASE_URL` for app runtime (pooler/transaction mode)
`DIRECT_URL` for migrations (direct/session mode)
- AI:
`GROQ_API_KEY`
- Reminders and notifications:
`UPSTASH_REDIS_URL` or `REDIS_URL`
`RESEND_API_KEY`
`RESEND_FROM_EMAIL`
`VAPID_PUBLIC_KEY`
`VAPID_PRIVATE_KEY`
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`
`VAPID_SUBJECT`
- App URL:
`NEXT_PUBLIC_APP_URL`
- Cron protection:
`CRON_SECRET`

## Common commands

- `npm run dev` - start local dev server
- `npm run type-check` - TypeScript checks
- `npm run build` - production build
- `npm run lint` - Biome checks
- `npm run db:migrate` - run Drizzle SQL migrations using `DIRECT_URL`
- `npm run jobs:reminders:run` - run reminder job once (manual test)
- `npm run jobs:reminders:worker` - start BullMQ queue worker + scheduler

## Migrations

This repo commits SQL migrations under `drizzle/`.

- Generate migration SQL: `npm run db:generate`
- Apply migrations: `npm run db:migrate`

Do not auto-run schema migrations during Vercel build. Run them from CI or manually before promoting production.

## Reminders: two runtime modes

1. Vercel Cron mode (current deployment default)
- `vercel.json` schedules `/api/cron/reminders` hourly.
- Route validates `Authorization: Bearer <CRON_SECRET>`.
- The route executes `runCheckRemindersJob()` directly.

2. Queue worker mode (long-running worker)
- Uses BullMQ with Redis.
- Start with `npm run jobs:reminders:worker`.
- Recommended only when running on infrastructure that supports persistent workers.

## Deployment

### Vercel project config

Set all required env vars in Vercel (Preview + Production as needed), including:

- `CRON_SECRET` (must match cron route auth check)
- Supabase keys
- DB connection strings
- Provider keys (Groq, Resend, VAPID, Redis if used)

### GitHub Actions

Workflow file: `.github/workflows/vercel-deploy.yml`

- PR to `main` -> preview deployment
- Push to `main` -> production deployment
- Manual trigger supported

Required repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Operational checks after deploy

1. Validate auth flows (login/signup/forgot-password).
2. Validate one deal create/update flow and one payment flow.
3. Trigger reminder run and confirm email/push behavior in logs.
4. Confirm cron execution in Vercel Cron logs.
5. Confirm no production endpoint is using development-only behavior.

## Notes

- `.env*` files are ignored by git, except `.env.example`.
- Keep `drizzle/` migrations committed to avoid schema drift across environments.
