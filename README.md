# Rooms Booking

Web app for **room sign-ups on group trips**. Participants assign themselves to
rooms and see live occupancy; organizers oversee, lock sign-ups, and spot rule
violations. Built to run **100% on free tiers** (Netlify + Supabase) — see
[`NEEDS.md`](./NEEDS.md) §11.

> Project assumptions live in [`NEEDS.md`](./NEEDS.md) (binding),
> [`DIRECTION.md`](./DIRECTION.md) (vision) and [`CLAUDE.md`](./CLAUDE.md)
> (architecture). Start with [`INDEX.md`](./INDEX.md).

## Stack
- **Frontend:** React + TypeScript + Vite → hosted on **Netlify** (free, with a
  free `*.netlify.app` domain).
- **Backend:** **Supabase** (free) — PostgreSQL + Realtime + Auth + RLS.
- Hard invariants (one room per person, capacity, lock) are enforced **in the
  database** via `SECURITY DEFINER` functions — never only in the client.

## Local setup
1. Install deps: `npm install`
2. Create a free Supabase project, then in the SQL editor run **every migration in
   `supabase/migrations/` in numeric order** (`0001_init.sql` … `0014_room_invites.sql`),
   plus `supabase/seed.sql` for optional demo data.
3. Copy `.env.example` → `.env` and fill `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
4. `npm run dev` and open the printed URL.

## Scripts
| Command | What it does |
|---------|--------------|
| `npm run dev` | Local dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Concurrency tests against a real Supabase project |

### Concurrency tests
`npm run test:integration` proves the DB-level invariants that unit tests can't
(capacity race for the last spot, one-room-per-person, server-side sign-up lock —
see `src/lib/concurrency.integration.test.ts`). They create a throwaway trip via
RPCs and delete it afterwards, so they need a reachable Supabase project:

```
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run test:integration
```

Without those env vars they skip cleanly (so `npm test`/CI stays green). They talk
to `*.supabase.co`, so in Claude Code web sessions that host must be on the
network egress allowlist.

## Deploy (Netlify, free)
Connect the repo to Netlify (build command `npm run build`, publish dir `dist`
— already set in `netlify.toml`) and add the two `VITE_SUPABASE_*` environment
variables in the Netlify UI.

## Email to participants — ⚠️ setup unfinished
The organizer dashboard can mail every participant their room assignment. Code and
UI are done and the Edge Function (`supabase/functions/send-room-emails`) is
deployed, but **the mail service still needs configuring before participants can
actually receive anything**:

1. Create a [Resend](https://resend.com) account (free tier: 100 mails/day) and
   generate an API key.
2. Supabase → Edge Functions → Secrets: add `RESEND_API_KEY`.
3. **Verify a sender domain in Resend** (DKIM/SPF DNS records). Without this,
   Resend delivers **only to the account owner's own address** — participants get
   nothing.
4. Add the `MAIL_FROM` secret, e.g. `Rooms <rooms@yourdomain.example>`.

Until steps 3–4 are done the dashboard shows a warning banner; remove the
`organizer.emailsSetupTodo` string once setup is complete. Only the organizer can
trigger a send — the Edge Function re-checks the passcode server-side via
`verify_organizer`.

## Status
Implemented: live room list & occupancy, atomic join/move/leave (no double
booking, capacity-safe), server-enforced sign-up lock, organizer dashboard
(headcount, colour status, MUST-HAVE vs preference signalling, manual assignment
overrides), organizer passcode authorization, trip & room management from the UI,
on-demand optimization plus a simulated-annealing solver, negotiated roommate
requests, participant-initiated room swaps and room invitations, PWA, and an
English/Polish UI.

Known gaps and technical debt are tracked in [`CLAUDE.md`](./CLAUDE.md) §8 —
including the mail setup above, participant identity limits (localStorage only),
the publicly readable organizer dashboard, and accessibility work.
