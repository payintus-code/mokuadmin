# Production Checklist

## Before deploy

- Rotate Supabase keys if any real key was ever committed before.
- Set production env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`
- Create required Supabase Auth users.
- Insert matching rows into `public.app_users` with the correct `role` and `is_active = true`.
- Apply database schema and migrations, especially:
  - `supabase/schema.sql`
  - `supabase/migrations/20260530_enable_rls_and_policies.sql`
- Confirm at least one admin account can log in.

## Security checks

- Verify `/finance`, `/finance/report`, `/finance/report/export`, and `/expenses/new` are blocked for non-admin users.
- Verify staff users can access bookings, customers, pets, rooms, payments, and schedule.
- Verify deleted or inactive `app_users` can no longer access the app.
- Confirm RLS is enabled on core tables in Supabase.
- Confirm HTTPS is enabled in production.
- Confirm security headers are present:
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`

## Release checks

- Run `npm ci`
- Run `npx tsc --noEmit`
- Run `npm run lint`
- Run `npm test`
- Run `npm run build`
- Make sure GitHub Actions `CI` workflow passes on the target branch.

## Smoke test after deploy

- Log in as `admin` and confirm dashboard, finance, report export, and payment flows work.
- Log in as `staff` and confirm finance pages are hidden and blocked.
- Create a booking, receive payment, and open the receipt page.
- Export finance CSV as admin.
- Confirm room availability and schedule pages still load correctly.

## Operational follow-up

- Add branch protection so deploy branches require the `CI` check to pass.
- Store secrets only in the deployment platform and GitHub Actions secrets, never in the repo.
- Keep a rollback plan for schema migrations and deploys.

