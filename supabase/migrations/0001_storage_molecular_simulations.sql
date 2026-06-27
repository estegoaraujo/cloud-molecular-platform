-- ============================================================================
-- 0001_storage_molecular_simulations.sql
--
-- Creates the `molecular-simulations` Storage bucket and the Row Level Security
-- policies that scope every object to the user who owns it.
--
-- Object key convention (enforced by the policies below):
--     molecular-simulations/<user_id>/<sim_id>/<filename>
--
-- The leading path segment is the user's auth UID, so a user can only read or
-- write objects inside their own folder. This holds for BOTH the uploaded .pdb
-- inputs and the trajectory outputs the backend writes back.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bucket
-- ----------------------------------------------------------------------------
-- Private bucket (public = false): objects are reachable only via authenticated
-- requests or short-lived signed URLs, never anonymously.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'molecular-simulations',
  'molecular-simulations',
  false,
  52428800, -- 50 MB cap per object; molecular files + short trajectories are small
  array[
    'chemical/x-pdb',          -- .pdb (some clients send this)
    'text/plain',              -- .pdb / .xyz are plain text; browsers often use this
    'application/octet-stream' -- fallback for .dcd / unknown trajectory binaries
  ]
)
on conflict (id) do update
  set file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. Row Level Security policies on storage.objects
-- ----------------------------------------------------------------------------
-- `storage.foldername(name)` splits the object key on '/'. Element [1] is the
-- first folder — our convention puts the owner's UID there. Comparing it to
-- `auth.uid()` confines each user to their own namespace.

-- Read own objects.
create policy "msim_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'molecular-simulations'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Upload into own folder.
create policy "msim_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'molecular-simulations'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Overwrite/replace own objects.
create policy "msim_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'molecular-simulations'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'molecular-simulations'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete own objects.
create policy "msim_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'molecular-simulations'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ----------------------------------------------------------------------------
-- NOTE ON THE BACKEND
-- The FastAPI service (Step 2) writes trajectory files using the Supabase
-- SERVICE ROLE key, which bypasses RLS. To preserve the per-user boundary, the
-- backend MUST still write under `<user_id>/...` keys. The policies above are
-- the guarantee for browser-side access; backend code is trusted but follows
-- the same path convention by contract.
-- ----------------------------------------------------------------------------
