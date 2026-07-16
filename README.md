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
2. Create a free Supabase project, then in the SQL editor run:
   - `supabase/migrations/0001_init.sql`
   - `supabase/seed.sql` (optional demo data)
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

## Status (MVP)
Implemented: live room list & occupancy, atomic join/move/leave (no double
booking, capacity-safe), server-enforced sign-up lock, organizer dashboard with
headcount, colour status, and MUST-HAVE vs preference rule signalling.

Next (see `NEEDS.md` / `DIRECTION.md`): real authentication & organizer-only
authorization, organizer manual room edits, automatic optimization/swap
proposals, email sending, Polish locale.
