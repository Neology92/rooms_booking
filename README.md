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
