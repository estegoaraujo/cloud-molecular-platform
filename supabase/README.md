# ThermRad — Supabase

Database & Storage configuration for ThermRad. Step 1 provisions auth (managed
by Supabase out of the box) and the `molecular-simulations` Storage bucket with
per-user Row Level Security.

## What's here

```
supabase/
└── migrations/
    └── 0001_storage_molecular_simulations.sql   # bucket + RLS policies
```

## Apply the migration

**Option A — Supabase CLI (recommended)**

```bash
# from repo root, with the CLI installed and linked to your project
supabase db push
```

**Option B — SQL Editor**

Open the Supabase Dashboard → SQL Editor, paste the contents of
`migrations/0001_storage_molecular_simulations.sql`, and run it.

## Object key convention

Every object is stored under the owner's auth UID:

```
molecular-simulations/<user_id>/<sim_id>/structure.pdb      # uploaded input
molecular-simulations/<user_id>/<sim_id>/trajectory.pdb     # backend output
```

The RLS policies use `(storage.foldername(name))[1] = auth.uid()` so a signed-in
user can only touch objects inside their own `<user_id>/` folder. Browser
clients use signed URLs; the FastAPI backend uses the service-role key (which
bypasses RLS) but writes under the same `<user_id>/` prefix by contract.

## Auth

Email/password auth needs no migration — enable it under
**Authentication → Providers → Email** in the dashboard. For local development
you can turn **"Confirm email"** off so signups sign in immediately; leave it on
for production (the app already handles the confirmation flow via
`/auth/callback`).
