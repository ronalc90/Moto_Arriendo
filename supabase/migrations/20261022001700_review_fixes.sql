-- =============================================================================
-- Fixes from the independent review (22/10/2026)
--  1. One active loan per driver: a payment carries a single loan_id, so with
--     two required loans a driver who paid exactly what the app asked could
--     still fall into arrears. To lend more, edit the existing loan's amount.
--  2. Drivers can only reference files inside their own storage folder
--     (receipts, inspection photos, damage photos, documents) — stops a driver
--     from pointing a row at the motorcycle's SOAT and getting it deleted.
--  3. Drivers cannot set payments.created_at (review queue order, reminders).
--  4. Odometer: a typo can no longer jump the motorcycle's km by more than
--     5.000 km in one inspection (it blocked future inspections and fired
--     false maintenance alerts).
--  5. Push subscriptions only for real push services, max 10 per user.
--  6. No "atraso" notice when the payments under review already cover the debt.
-- =============================================================================

-- 1) One active loan per driver -------------------------------------------------
create unique index if not exists loans_one_active_per_driver
  on public.loans (driver_id) where status = 'active';

-- 2-4) Extra checks on rows inserted by drivers ---------------------------------
create or replace function public.path_in_my_folder(p_path text)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_path is null
      or (p_path not like '%..%'
          and p_path like (public.my_driver_id())::text || '/%')
$$;
revoke execute on function public.path_in_my_folder(text) from public, anon;
grant execute on function public.path_in_my_folder(text) to authenticated;

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
    if not public.path_in_my_folder(new.file_path) then
      raise exception 'El archivo no es válido';
    end if;
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

-- "zz_" so they run after the triggers that fill driver/motorcycle ids.
create or replace trigger zz_payments_validate before insert on public.payments
  for each row execute function public.driver_rows_validate();
create or replace trigger zz_documents_validate before insert on public.documents
  for each row execute function public.driver_rows_validate();
create or replace trigger zz_damage_reports_validate before insert on public.damage_reports
  for each row execute function public.driver_rows_validate();
create or replace trigger zz_inspections_validate before insert on public.inspections
  for each row execute function public.driver_rows_validate();
revoke execute on function public.driver_rows_validate() from public, anon, authenticated;

-- 5) Push subscriptions ----------------------------------------------------------
create or replace function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select length(p_endpoint) < 1000
     and p_endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com)/'
$$;

-- Counted in a definer function: a subquery on the same table inside its own
-- policy would recurse.
create or replace function public.my_push_subscription_count()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::integer from public.push_subscriptions where profile_id = auth.uid()
$$;
revoke execute on function public.my_push_subscription_count() from public, anon;
grant execute on function public.my_push_subscription_count() to authenticated;

alter policy push_own_insert on public.push_subscriptions
  with check (
    profile_id = (select auth.uid())
    and public.is_push_endpoint(endpoint)
    and public.my_push_subscription_count() < 10
  );

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  if not public.is_push_endpoint(p_endpoint) or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'Suscripción no válida';
  end if;
  -- Dead devices are removed by the notify function (404/410), so 10 is plenty.
  if (select count(*) from public.push_subscriptions s
       where s.profile_id = auth.uid() and s.endpoint <> p_endpoint) >= 10 then
    raise exception 'Ya activaste los avisos en 10 dispositivos. Desactívalos en alguno que ya no uses.';
  end if;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- 6) Late notice only when the debt is not already covered by payments in review --
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

  select count(*) into v_after from public.notifications;
  return v_after - v_before;
end;
$$;
revoke execute on function public.generate_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.generate_notifications(timestamptz) to service_role;
