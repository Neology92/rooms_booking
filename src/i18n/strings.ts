// All user-facing copy lives here so the UI ships in English (NEEDS §12) and a
// future locale (e.g. Polish — see DIRECTION.md) is a drop-in second dictionary.
export const en = {
  app: {
    title: "Room Sign-up",
    loading: "Loading…",
    missingConfig:
      "Supabase is not configured. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  },
  tabs: {
    participant: "Sign up",
    organizer: "Organizer",
  },
  participant: {
    whoAreYou: "Who are you?",
    pickName: "Select your name",
    rooms: "Rooms",
    join: "Join",
    leave: "Leave",
    full: "Full",
    youAreHere: "You are here",
    spotsLeft: (n: number) => `${n} spot${n === 1 ? "" : "s"} left`,
    locked: "Sign-ups are locked by the organizer.",
  },
  organizer: {
    title: "Organizer dashboard",
    signedUp: "Signed up",
    target: "Target",
    lockSignups: "Lock sign-ups",
    unlockSignups: "Unlock sign-ups",
    locked: "LOCKED",
    open: "OPEN",
    occupancy: "Occupancy",
    issues: "Issues",
    allGood: "All rules satisfied",
    mustHaveViolation: "MUST-HAVE not met",
    preferenceUnmet: "Preference not met",
  },
  errors: {
    ROOM_FULL: "That room is already full.",
    SIGNUPS_LOCKED: "Sign-ups are locked.",
    ROOM_NOT_FOUND: "Room not found.",
    PARTICIPANT_NOT_IN_TRIP: "You are not part of this trip.",
    UNKNOWN: "Something went wrong. Please try again.",
  },
} as const;

export type Strings = typeof en;
