# ThermRad Frontend

Next.js (App Router, TypeScript, Tailwind) UI with Supabase email/password auth,
a protected dashboard, and — from Step 3 — the in-browser molecular trajectory
viewer.

## Stack

- **Next.js 15** (App Router, React 19, Server Actions)
- **Supabase** auth via `@supabase/ssr` (cookie-based sessions across server +
  client)
- **Tailwind CSS** with the ThermRad design tokens (`tailwind.config.ts`,
  `globals.css`)

## Setup

```bash
cd frontend
cp .env.local.example .env.local   # fill in your Supabase project values
npm install
npm run dev                        # http://localhost:3000
```

You also need the Supabase storage bucket + policies applied — see
[`../supabase/README.md`](../supabase/README.md).

## Auth flow

```
/signup ──signup() action──► Supabase signUp
   │                              │
   │                    confirmation email? ──► /login?checkEmail=1
   │                              │
/login ──login() action──► signInWithPassword ──► /dashboard (protected)
```

- `middleware.ts` → `src/lib/supabase/middleware.ts` refreshes the session on
  every request and enforces route guards (anon → `/login`, signed-in away from
  auth pages).
- `src/app/auth/actions.ts` holds the `login` / `signup` / `signout` server
  actions.
- `src/app/auth/callback/route.ts` handles the email-confirmation code exchange.

## Key paths

| Path                                | Purpose                                  |
| ----------------------------------- | ---------------------------------------- |
| `src/lib/supabase/client.ts`        | Browser Supabase client                  |
| `src/lib/supabase/server.ts`        | Server Supabase client (per request)     |
| `src/lib/supabase/middleware.ts`    | Session refresh + route guards           |
| `src/app/(auth)/login`              | Sign-in page                             |
| `src/app/(auth)/signup`             | Sign-up page                             |
| `src/app/dashboard`                 | Protected console (Step 1 shell)         |
| `src/components/auth/*`             | Auth form + ambient scene                |

## Scripts

- `npm run dev` — start dev server
- `npm run build` / `npm run start` — production build + serve
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
