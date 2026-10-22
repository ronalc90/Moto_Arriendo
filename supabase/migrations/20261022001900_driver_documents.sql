-- =============================================================================
-- Driver documents (22/10/2026)
--  * Cédula and license need BOTH sides (front + back photo).
--  * Documents uploaded by drivers wait for the admin to check they are
--    readable: approve, or reject with a reason (the driver is notified and
--    uploads it again). Rejected documents don't count for expirations.
--  * "Pendientes por llenar": documents to review and missing photos; weekly
--    reminder to the driver.
-- =============================================================================
alter table public.documents
  add column if not exists back_file_path text,
  add column if not exists review_status text not null default 'approved',
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references public.profiles (id),
  add column if not exists reviewed_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'documents_review_status') then
    alter table public.documents add constraint documents_review_status
      check (review_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create or replace function public.driver_rows_validate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_km integer;
  p text;
begin
  if public.is_admin() or public.is_privileged_role() then
    return new;
  end if;

  if tg_table_name = 'payments' then
    new.created_at := now();
    if not public.path_in_my_folder(new.receipt_path) then
      raise exception 'El comprobante no es válido';
    end if;
  elsif tg_table_name = 'documents' then
    if not public.path_in_my_folder(new.file_path) or not public.path_in_my_folder(new.back_file_path) then
      raise exception 'El archivo no es válido';
    end if;
    if new.file_path is null then
      raise exception 'Sube la foto del documento';
    end if;
    if new.doc_type in ('national_id', 'license') and new.back_file_path is null then
      raise exception 'Sube la foto de los dos lados (frente y reverso)';
    end if;
    -- Documents from drivers wait for the admin to check they are readable.
    new.review_status := 'pending';
    new.review_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif tg_table_name = 'damage_reports' then
    foreach p in array coalesce(new.photos, '{}') loop
      if not public.path_in_my_folder(p) then
        raise exception 'Las fotos no son válidas';
      end if;
    end loop;
  elsif tg_table_name = 'inspections' then
    if not (public.path_in_my_folder(new.photo_front) and public.path_in_my_folder(new.photo_back)
            and public.path_in_my_folder(new.photo_left) and public.path_in_my_folder(new.photo_right)
            and public.path_in_my_folder(new.photo_dashboard)) then
      raise exception 'Las fotos no son válidas';
    end if;
    select m.current_km into v_km from public.motorcycles m where m.id = new.motorcycle_id;
    if new.km < coalesce(v_km, 0) then
      raise exception 'El kilometraje no puede ser menor al último registrado (% km)', v_km;
    end if;
    if new.km > coalesce(v_km, 0) + 5000 then
      raise exception 'El kilometraje parece muy alto (más de 5.000 km desde la última vez). Revísalo; si es correcto, pídele al administrador que lo actualice.';
    end if;
  end if;
  return new;
end;
$$;


-- Review bookkeeping + notices --------------------------------------------------------
create or replace function public.documents_review()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_label text := case new.doc_type when 'national_id' then 'cédula' when 'license' then 'licencia'
                    when 'background_check' then 'antecedentes' else 'documento' end;
  v_profile uuid;
  v_name text;
begin
  if new.driver_id is null then
    return new;
  end if;
  select d.profile_id, p.full_name into v_profile, v_name
    from public.drivers d join public.profiles p on p.id = d.profile_id where d.id = new.driver_id;

  if tg_op = 'INSERT' then
    if new.review_status = 'pending' then
      perform public.notify_admins('documents', '🪪 ' || v_name || ' subió su ' || v_label,
        'Revisa que la foto se lea bien y apruébala.', '/admin/conductores/' || new.driver_id, 'docup:' || new.id);
    end if;
  elsif new.review_status is distinct from old.review_status then
    if new.review_status = 'approved' then
      perform public.notify(v_profile, 'documents', 'Tu ' || v_label || ' fue aprobada ✅',
        'El administrador revisó la foto y está bien.', '/conductor/documentos', 'docok:' || new.id);
    elsif new.review_status = 'rejected' then
      perform public.notify(v_profile, 'documents', 'Sube de nuevo tu ' || v_label,
        coalesce(new.review_notes, 'La foto no se lee bien.') || ' Tómala otra vez con buena luz y sin reflejos.',
        '/conductor/documentos', 'docko:' || new.id || ':' || extract(epoch from now())::bigint);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.documents_review() from public, anon, authenticated;

create or replace function public.documents_before_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.review_status is distinct from old.review_status then
    if new.review_status = 'rejected' and length(trim(coalesce(new.review_notes, ''))) < 3 then
      raise exception 'Escribe por qué la rechazas (el conductor lo verá)';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create or replace trigger documents_before_review before update on public.documents
  for each row execute function public.documents_before_review();
create or replace trigger documents_review_notify after insert or update of review_status on public.documents
  for each row execute function public.documents_review();

-- Rejected documents don't count for expirations ----------------------------------------
create or replace view public.document_expirations
with (security_invoker = true) as
with latest as (
  select distinct on (d.entity, coalesce(d.motorcycle_id, d.driver_id), d.doc_type)
    d.id as document_id, d.entity, d.motorcycle_id, d.driver_id, d.doc_type, d.expires_on
  from public.documents d
  where d.expires_on is not null
    and d.review_status <> 'rejected'
    and d.doc_type in ('soat', 'insurance', 'tech_inspection', 'license')
  order by d.entity, coalesce(d.motorcycle_id, d.driver_id), d.doc_type, d.expires_on desc
)
select l.document_id, l.entity::text as entity, l.motorcycle_id, l.driver_id,
       l.doc_type::text as doc_type, l.expires_on,
       (l.expires_on - public.bogota_today()) as days_left,
       m.plate, pr.full_name as driver_name
from latest l
left join public.motorcycles m on m.id = l.motorcycle_id
left join public.drivers dr on dr.id = l.driver_id
left join public.profiles pr on pr.id = dr.profile_id
where (l.motorcycle_id is null or m.status <> 'inactive')
  and (l.driver_id is null or dr.status = 'active')
union all
select null, 'driver', null, dr.id, 'license', dr.license_expires_on,
       (dr.license_expires_on - public.bogota_today()), null, pr.full_name
from public.drivers dr
join public.profiles pr on pr.id = dr.profile_id
where dr.license_expires_on is not null
  and dr.status = 'active'
  and not exists (select 1 from latest l where l.driver_id = dr.id and l.doc_type = 'license')
union all
select null, 'motorcycle', m.id, null, 'tech_inspection', (m.purchase_date + interval '2 years')::date,
       ((m.purchase_date + interval '2 years')::date - public.bogota_today()), m.plate, null
from public.motorcycles m
where m.purchase_date is not null
  and m.status <> 'inactive'
  and not exists (select 1 from latest l where l.motorcycle_id = m.id and l.doc_type = 'tech_inspection');

-- Pending items ---------------------------------------------------------------------
create or replace function public.setup_pending()
returns table (kind text, ref_id uuid, title text, body text, url text)
language sql stable security definer
set search_path = ''
as $$
  with active_drivers as (
    select d.id, p.full_name, p.onboarded_at
      from public.drivers d join public.profiles p on p.id = d.profile_id
     where p.active and d.status = 'active'
  ),
  free_motos as (
    select m.id from public.motorcycles m
     where m.status = 'active'
       and not exists (select 1 from public.contracts c where c.motorcycle_id = m.id and c.status = 'active')
  )
  -- Drivers without a contract (and maybe without a motorcycle to give them)
  select 'contract'::text, d.id,
         case when exists (select 1 from free_motos) then 'Falta el contrato de ' || d.full_name
              else 'Falta la moto y el contrato de ' || d.full_name end,
         case when exists (select 1 from free_motos)
              then 'Crea su contrato: moto, tarifa diaria, día de descanso y fecha de inicio.'
              else 'Primero registra su moto (placa, precio, fecha de compra y kilometraje) y luego crea el contrato.' end,
         case when exists (select 1 from free_motos) then '/admin/contratos/nuevo?conductor=' || d.id
              else '/admin/motos/nueva' end
    from active_drivers d
   where (public.is_admin() or public.is_privileged_role())
     and not exists (select 1 from public.contracts c where c.driver_id = d.id and c.status = 'active')
  union all
  -- Drivers who have not filled in their own data yet
  select 'driver_data', d.id, d.full_name || ' no ha llenado sus datos',
         'Cuando entre a la app por primera vez le pedirá cédula, licencia y contacto de emergencia.',
         '/admin/conductores/' || d.id
    from active_drivers d
   where (public.is_admin() or public.is_privileged_role()) and d.onboarded_at is null
  union all
  -- Motorcycles without SOAT or insurance dates
  select 'moto_docs', m.id,
         'A la moto ' || m.plate || ' le falta ' ||
           array_to_string(array_remove(array[
             case when not exists (select 1 from public.documents x where x.motorcycle_id = m.id and x.doc_type = 'soat' and x.expires_on is not null) then 'el SOAT' end,
             case when not exists (select 1 from public.documents x where x.motorcycle_id = m.id and x.doc_type = 'insurance' and x.expires_on is not null) then 'el seguro' end
           ], null), ' y '),
         'Súbelo con su fecha de vencimiento para que la app te avise antes de que se venza.',
         '/admin/motos/' || m.id
    from public.motorcycles m
   where (public.is_admin() or public.is_privileged_role()) and m.status <> 'inactive'
     and (not exists (select 1 from public.documents x where x.motorcycle_id = m.id and x.doc_type = 'soat' and x.expires_on is not null)
       or not exists (select 1 from public.documents x where x.motorcycle_id = m.id and x.doc_type = 'insurance' and x.expires_on is not null))
  union all
  -- Documents from drivers waiting for the admin to check them
  select 'doc_review', x.id,
         'Revisa ' || case x.doc_type when 'national_id' then 'la cédula' when 'license' then 'la licencia'
                                      when 'background_check' then 'los antecedentes' else 'un documento' end
           || ' de ' || p.full_name,
         'Mira que la foto se lea bien y apruébala o pídele que la suba de nuevo.',
         '/admin/conductores/' || x.driver_id
    from public.documents x join public.drivers d on d.id = x.driver_id join public.profiles p on p.id = d.profile_id
   where (public.is_admin() or public.is_privileged_role()) and x.review_status = 'pending' and p.active
  union all
  -- Drivers (already registered in the app) without the photos of their cédula or license
  select 'driver_docs', d.id,
         'Faltan las fotos de ' ||
           array_to_string(array_remove(array[
             case when not exists (select 1 from public.documents x where x.driver_id = d.id and x.doc_type = 'national_id'
                                     and x.review_status <> 'rejected' and x.back_file_path is not null) then 'la cédula' end,
             case when not exists (select 1 from public.documents x where x.driver_id = d.id and x.doc_type = 'license'
                                     and x.review_status <> 'rejected' and x.back_file_path is not null) then 'la licencia' end
           ], null), ' y ') || ' de ' || d.full_name,
         'Se le pidió subirlas por los dos lados desde Mis documentos.',
         '/admin/conductores/' || d.id
    from active_drivers d
   where (public.is_admin() or public.is_privileged_role()) and d.onboarded_at is not null
     and (not exists (select 1 from public.documents x where x.driver_id = d.id and x.doc_type = 'national_id'
                        and x.review_status <> 'rejected' and x.back_file_path is not null)
       or not exists (select 1 from public.documents x where x.driver_id = d.id and x.doc_type = 'license'
                        and x.review_status <> 'rejected' and x.back_file_path is not null))
  union all
  -- Contracts without the signed document
  select 'contract_file', c.id, 'Falta subir el contrato firmado de ' || p.full_name,
         'Sube el PDF o una foto del contrato firmado.', '/admin/contratos/' || c.id
    from public.contracts c join public.drivers d on d.id = c.driver_id join public.profiles p on p.id = d.profile_id
   where (public.is_admin() or public.is_privileged_role()) and c.status = 'active' and c.file_path is null
$$;
revoke execute on function public.setup_pending() from public, anon;
grant execute on function public.setup_pending() to authenticated;

create or replace function public.generate_notifications(p_now timestamptz default now())
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_local timestamp := p_now at time zone 'America/Bogota';
  v_today date := (p_now at time zone 'America/Bogota')::date;
  s public.settings%rowtype;
  c record;
  sm record;
  e record;
  mt record;
  sp record;
  v_before integer;
  v_after integer;
  v_bucket integer;
  v_label text;
  v_driver_profile uuid;
  v_week_start date;
begin
  select count(*) into v_before from public.notifications;
  select * into s from public.settings where id = 1;
  v_week_start := v_today - ((extract(dow from v_today)::integer - s.inspection_weekday + 7) % 7);

  for c in
    select ct.*, d.profile_id, p.full_name as driver_name, m.plate
      from public.contracts ct
      join public.drivers d on d.id = ct.driver_id
      join public.profiles p on p.id = d.profile_id and p.active
      join public.motorcycles m on m.id = ct.motorcycle_id
     where ct.status = 'active'
  loop
    select * into sm from public.contract_summary(c.id, p_now);

    -- 1) 7:00 p. m. payment reminder if today is chargeable and nothing was sent today
    if v_local::time >= s.payment_reminder_time and v_local::time < c.payment_deadline
       and sm.today_kind = 'chargeable' and sm.due_today > 0
       and not exists (
         select 1 from public.payments py
          where py.contract_id = c.id and py.status in ('pending', 'approved')
            and (py.created_at at time zone 'America/Bogota')::date = v_today)
    then
      perform public.notify(c.profile_id, 'payment_reminder', 'Recuerda tu pago de hoy',
        'Debes ' || public.fmt_cop(sm.due_today) || '. Paga antes de las '
          || to_char(c.payment_deadline, 'FMHH12:MI') || ' p. m.',
        '/conductor/pagar', 'payrem:' || c.id || ':' || v_today);
    end if;

    -- 2) Late payments (daily)
    -- Skip it when the payments waiting for review already cover the debt
    -- (the driver paid on time, the admin has not approved yet).
    if sm.late_days > 0 and sm.pending_amount < sm.total_debt then
      perform public.notify(c.profile_id, 'late',
        'Tienes ' || sm.late_days || case when sm.late_days = 1 then ' día' else ' días' end || ' de atraso',
        'Debes ' || public.fmt_cop(sm.total_debt) || '. Con ' || c.max_late_days || ' días se devuelve la moto.',
        '/conductor', 'late:' || c.id || ':' || v_today);
      perform public.notify_admins(case when sm.light = 'red' then 'late_red' else 'late' end,
        case when sm.light = 'red' then '🔴 Atraso grave: ' else '🟡 Atraso: ' end || c.driver_name,
        sm.late_days || ' días · debe ' || public.fmt_cop(sm.total_debt) || ' · ' || c.plate,
        '/admin/conductores/' || c.driver_id, 'late:' || c.id || ':' || v_today);
    end if;

    -- 3) Weekly inspection pending (driver from 8 a. m. of the inspection day, admins the day after)
    if c.start_date <= v_week_start and not exists (
         select 1 from public.inspections i
          where i.driver_id = c.driver_id and i.motorcycle_id = c.motorcycle_id and i.inspected_on >= v_week_start)
    then
      if v_local::time >= time '08:00' then
        perform public.notify(c.profile_id, 'inspection', 'Inspección semanal pendiente',
          'Toma las 5 fotos de la moto y el kilometraje. Son 2 minutos.',
          '/conductor/inspeccion', 'insp:' || c.id || ':' || v_week_start);
      end if;
      if v_today > v_week_start then
        perform public.notify_admins('inspection', 'Inspección pendiente: ' || c.driver_name,
          'No ha enviado la inspección de la semana (' || c.plate || ').',
          '/admin/inspecciones', 'insp:' || c.id || ':' || v_week_start);
      end if;
    end if;
  end loop;

  -- 4) Document expirations: 30, 15 and 7 days before (and once expired)
  for e in select * from public.document_expirations where days_left <= 30 loop
    v_bucket := case when e.days_left < 0 then 0 when e.days_left <= 7 then 7 when e.days_left <= 15 then 15 else 30 end;
    v_label := case e.doc_type
      when 'soat' then 'SOAT' when 'insurance' then 'Seguro' when 'tech_inspection' then 'Técnico-mecánica'
      when 'license' then 'Licencia de conducción' else e.doc_type end;
    perform public.notify_admins('expiration',
      v_label || ' ' || coalesce(e.plate, e.driver_name, '') ||
        case when e.days_left < 0 then ' está vencido' when e.days_left = 0 then ' vence hoy'
             else ' vence en ' || e.days_left || ' días' end,
      'Fecha de vencimiento: ' || to_char(e.expires_on, 'DD/MM/YYYY'),
      case when e.motorcycle_id is not null then '/admin/motos/' || e.motorcycle_id else '/admin/conductores/' || e.driver_id end,
      'exp:' || e.doc_type || ':' || coalesce(e.motorcycle_id, e.driver_id) || ':' || e.expires_on || ':' || v_bucket);
    if e.doc_type = 'license' and e.driver_id is not null then
      select profile_id into v_driver_profile from public.drivers where id = e.driver_id;
      perform public.notify(v_driver_profile, 'expiration',
        'Tu licencia ' || case when e.days_left < 0 then 'está vencida' else 'vence en ' || e.days_left || ' días' end,
        'Renuévala a tiempo y sube la nueva en Mis documentos.', '/conductor/documentos',
        'exp:license:' || e.expires_on || ':' || v_bucket);
    end if;
  end loop;

  -- 5) Maintenance due soon / overdue
  for mt in select * from public.maintenance_due where status in ('soon', 'due', 'overdue') loop
    v_label := case mt.service_type when 'first_service' then 'Primera revisión de garantía'
      when 'oil_change' then 'Cambio de aceite' else 'Revisión general' end;
    perform public.notify_admins('maintenance',
      case when mt.status = 'overdue' then 'Mantenimiento atrasado: ' else 'Mantenimiento próximo: ' end
        || lower(v_label) || ' · ' || mt.plate,
      case when mt.km_left > 0 then 'Faltan ' || mt.km_left || ' km' else 'Se pasó por ' || abs(mt.km_left) || ' km' end
        || ' (toca a los ' || mt.next_km || ' km; va en ' || mt.current_km || ' km).',
      '/admin/motos/' || mt.motorcycle_id, 'maint:' || mt.motorcycle_id || ':' || mt.service_type || ':' || mt.next_km || ':' || mt.status);
    if mt.service_type = 'oil_change' then
      select d.profile_id into v_driver_profile
        from public.contracts ct join public.drivers d on d.id = ct.driver_id
       where ct.motorcycle_id = mt.motorcycle_id and ct.status = 'active';
      perform public.notify(v_driver_profile, 'maintenance',
        case when mt.status = 'overdue' then 'Cambio de aceite atrasado' else 'Cambio de aceite próximo' end,
        case when mt.km_left > 0 then 'Faltan ' || mt.km_left || ' km.' else 'Ya se pasó. Hazlo cuanto antes.' end,
        '/conductor', 'maint:' || mt.motorcycle_id || ':' || mt.next_km || ':' || mt.status);
    end if;
  end loop;

  -- 6) What the admin still has to fill in (once a week per pending item)
  for sp in select * from public.setup_pending() where kind in ('contract', 'moto_docs', 'contract_file') loop
    perform public.notify_admins('setup', '📝 ' || sp.title, sp.body, sp.url,
      'setup:' || sp.kind || ':' || sp.ref_id || ':' || v_week_start);
  end loop;

  -- Drivers missing the photos of their documents (weekly)
  for sp in select su.kind, su.ref_id, d.profile_id from public.setup_pending() su
             join public.drivers d on d.id = su.ref_id where su.kind = 'driver_docs' loop
    perform public.notify(sp.profile_id, 'documents', 'Sube las fotos de tus documentos',
      'Toma la foto de tu cédula y de tu licencia por los dos lados en Mis documentos.',
      '/conductor/documentos', 'docs:' || sp.ref_id || ':' || v_week_start);
  end loop;

  select count(*) into v_after from public.notifications;
  return v_after - v_before;
end;
$$;
revoke execute on function public.generate_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.generate_notifications(timestamptz) to service_role;

