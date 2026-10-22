-- =============================================================================
-- Automated test: driver documents (both sides, review by the admin,
-- notices, pending items, expirations). Rolls back.
-- =============================================================================
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'b1@example.com');
insert into public.profiles (id, full_name, phone, role, email, data_consent_at, onboarded_at) values
  ('00000000-0000-4000-8000-0000000000a1', 'Admin', null, 'admin', 'a@example.com', null, null),
  ('00000000-0000-4000-8000-0000000000b1', 'Hamer Pérez', '3100000001', 'driver', null, now(), now());
insert into public.drivers (id, profile_id, national_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', '1012345678');
delete from public.notifications;

do $$ begin
  assert exists (select 1 from public.setup_pending() where kind = 'driver_docs'
                   and title = 'Faltan las fotos de la cédula y la licencia de Hamer Pérez'), 'missing photos listed';
end $$;

-- As the driver
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
do $$
declare v_id uuid;
begin
  begin
    insert into public.documents (entity, driver_id, doc_type, file_path)
    values ('driver', '00000000-0000-4000-8000-0000000000d1', 'national_id', '00000000-0000-4000-8000-0000000000d1/cc.jpg');
    raise exception 'FAIL: cédula with one side accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- a driver cannot approve their own document
  insert into public.documents (entity, driver_id, doc_type, file_path, back_file_path, review_status)
  values ('driver', '00000000-0000-4000-8000-0000000000d1', 'national_id',
          '00000000-0000-4000-8000-0000000000d1/cc.jpg', '00000000-0000-4000-8000-0000000000d1/cc-back.jpg', 'approved')
  returning id into v_id;
  assert (select review_status from public.documents where id = v_id) = 'pending', 'driver uploads start pending';
  update public.documents set review_status = 'approved' where id = v_id;
  assert (select review_status from public.documents where id = v_id) = 'pending', 'driver cannot approve';
  insert into public.documents (entity, driver_id, doc_type, file_path, back_file_path, expires_on)
  values ('driver', '00000000-0000-4000-8000-0000000000d1', 'license',
          '00000000-0000-4000-8000-0000000000d1/lic.jpg', '00000000-0000-4000-8000-0000000000d1/lic-back.jpg',
          public.bogota_today() + 20);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

do $$ begin
  assert (select count(*) from public.notifications where kind = 'documents' and title like '🪪 Hamer Pérez subió su %') = 2, 'admin notified of uploads';
  assert (select count(*) from public.setup_pending() where kind = 'doc_review') = 2, 'two docs to review';
  assert not exists (select 1 from public.setup_pending() where kind = 'driver_docs'), 'photos no longer missing';
end $$;

-- As the admin: approve the cédula, reject the license (reason required)
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  update public.documents set review_status = 'approved' where doc_type = 'national_id';
  begin
    update public.documents set review_status = 'rejected' where doc_type = 'license';
    raise exception 'FAIL: rejection without reason accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  update public.documents set review_status = 'rejected', review_notes = 'La foto está borrosa.' where doc_type = 'license';
  assert (select reviewed_by from public.documents where doc_type = 'license') = '00000000-0000-4000-8000-0000000000a1', 'reviewer saved';
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

do $$ begin
  assert exists (select 1 from public.notifications where profile_id = '00000000-0000-4000-8000-0000000000b1'
                   and title = 'Tu cédula fue aprobada ✅'), 'driver told approved';
  assert exists (select 1 from public.notifications where profile_id = '00000000-0000-4000-8000-0000000000b1'
                   and title = 'Sube de nuevo tu licencia' and body like 'La foto está borrosa.%'), 'driver told rejected with reason';
  assert exists (select 1 from public.setup_pending() where kind = 'driver_docs'
                   and title = 'Faltan las fotos de la licencia de Hamer Pérez'), 'rejected license counts as missing';
  assert not exists (select 1 from public.document_expirations where driver_id = '00000000-0000-4000-8000-0000000000d1'
                       and document_id is not null), 'rejected license ignored for expirations';
  perform public.generate_notifications();
  assert exists (select 1 from public.notifications where profile_id = '00000000-0000-4000-8000-0000000000b1'
                   and title = 'Sube las fotos de tus documentos'), 'weekly reminder to the driver';
  raise notice 'Documents tests OK';
end $$;
rollback;
