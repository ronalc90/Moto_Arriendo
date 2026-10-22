-- =============================================================================
-- Moto Arriendo - private storage buckets and their access policies.
--
-- Path convention (first folder decides who can read it):
--   receipts/<driver_id>/<file>          payment receipts
--   inspections/<driver_id>/<file>       weekly inspection photos
--   damages/<driver_id>/<file>           damage report photos
--   documents/<driver_id>/<file>         driver personal documents (sensitive)
--   documents/moto/<motorcycle_id>/<file> motorcycle documents (SOAT, insurance...)
--   contracts/<driver_id>/<file>         signed contract PDFs
--
-- File size and MIME type limits are enforced by Supabase Storage itself
-- (server side), in addition to the checks in the app.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 6 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('inspections', 'inspections', false, 6 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('damages', 'damages', false, 6 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', false, 10 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('contracts', 'contracts', false, 10 * 1024 * 1024,
    array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Admins: full access to all app buckets.
create policy storage_admin_all on storage.objects for all to authenticated
  using (
    bucket_id in ('receipts', 'inspections', 'damages', 'documents', 'contracts')
    and (select public.is_admin())
  )
  with check (
    bucket_id in ('receipts', 'inspections', 'damages', 'documents', 'contracts')
    and (select public.is_admin())
  );

-- Drivers: read files inside their own folder, plus documents of the
-- motorcycle they currently drive.
create policy storage_driver_select on storage.objects for select to authenticated
  using (
    (
      bucket_id in ('receipts', 'inspections', 'damages', 'documents', 'contracts')
      and (storage.foldername(name))[1] = (select public.my_driver_id())::text
    )
    or (
      bucket_id = 'documents'
      and (storage.foldername(name))[1] = 'moto'
      and (storage.foldername(name))[2] = (select public.my_motorcycle_id())::text
    )
  );

-- Drivers: upload only into their own folder (no updates, no deletes).
create policy storage_driver_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('receipts', 'inspections', 'damages', 'documents')
    and (storage.foldername(name))[1] = (select public.my_driver_id())::text
  );
