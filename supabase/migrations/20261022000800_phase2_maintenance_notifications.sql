-- =============================================================================
-- Phase 2: maintenance by kilometers + notifications (in-app, web push, email)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Settings: configurable maintenance intervals and reminder time
-- ---------------------------------------------------------------------------
alter table public.settings
  add column first_service_min_km integer not null default 500 check (first_service_min_km >= 0),
  add column first_service_km integer not null default 1000 check (first_service_km > 0),
  add column oil_change_interval_km integer not null default 2000 check (oil_change_interval_km > 0),
  add column general_service_interval_km integer not null default 4000 check (general_service_interval_km > 0),
  add column maintenance_alert_km integer not null default 200 check (maintenance_alert_km >= 0),
  add column payment_reminder_time time not null default '19:00';

-- ---------------------------------------------------------------------------
-- Maintenance records (services and repairs, with invoice, cost, who paid)
-- ---------------------------------------------------------------------------
create type public.maintenance_type as enum ('first_service', 'oil_change', 'general_service', 'repair', 'other');
create type public.payer as enum ('driver', 'owner');

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles (id) on delete cascade,
  service_type public.maintenance_type not null,
  performed_on date not null default public.bogota_today(),
  km integer not null check (km >= 0 and km < 1000000),
  description text,
  workshop text,
  cost integer not null default 0 check (cost >= 0),
  paid_by public.payer not null default 'owner',
  invoice_path text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index maintenance_records_moto_idx on public.maintenance_records (motorcycle_id, performed_on desc);

alter table public.maintenance_records enable row level security;
create policy maintenance_select on public.maintenance_records for select to authenticated
  using ((select public.is_admin()) or motorcycle_id = (select public.my_motorcycle_id()));
create policy maintenance_admin_write on public.maintenance_records for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.maintenance_records from anon;

create trigger maintenance_records_audit after insert or update or delete on public.maintenance_records
  for each row execute function public.audit_trigger();

-- Keep the odometer up to date from service records too.
create or replace function public.maintenance_after_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.motorcycles set current_km = greatest(current_km, new.km) where id = new.motorcycle_id;
  return null;
end;
$$;
create trigger maintenance_after_insert after insert on public.maintenance_records
  for each row execute function public.maintenance_after_insert();
revoke execute on function public.maintenance_after_insert() from public, anon, authenticated;

-- Next due service per motorcycle.
-- status: ok | soon (within maintenance_alert_km) | due (first service window reached) | overdue
create view public.maintenance_due
with (security_invoker = true) as
with last_service as (
  select m.id as motorcycle_id,
         max(r.km) filter (where r.service_type = 'first_service') as first_km,
         max(r.km) filter (where r.service_type in ('oil_change', 'first_service', 'general_service')) as oil_km,
         max(r.km) filter (where r.service_type in ('general_service')) as general_km
  from public.motorcycles m
  left join public.maintenance_records r on r.motorcycle_id = m.id
  group by m.id
),
items as (
  -- first warranty service (500 - 1000 km)
  select m.id as motorcycle_id, m.plate, m.current_km, 'first_service'::text as service_type,
         s.first_service_km as next_km,
         case
           when ls.first_km is not null then null
           when m.current_km > s.first_service_km then 'overdue'
           when m.current_km >= s.first_service_min_km then 'due'
           else 'ok'
         end as status
  from public.motorcycles m
  join last_service ls on ls.motorcycle_id = m.id
  cross join public.settings s
  where m.status <> 'inactive'
  union all
  select m.id, m.plate, m.current_km, 'oil_change',
         coalesce(ls.oil_km, 0) + s.oil_change_interval_km,
         case
           when m.current_km >= coalesce(ls.oil_km, 0) + s.oil_change_interval_km then 'overdue'
           when m.current_km >= coalesce(ls.oil_km, 0) + s.oil_change_interval_km - s.maintenance_alert_km then 'soon'
           else 'ok'
         end
  from public.motorcycles m
  join last_service ls on ls.motorcycle_id = m.id
  cross join public.settings s
  where m.status <> 'inactive'
  union all
  select m.id, m.plate, m.current_km, 'general_service',
         coalesce(ls.general_km, 0) + s.general_service_interval_km,
         case
           when m.current_km >= coalesce(ls.general_km, 0) + s.general_service_interval_km then 'overdue'
           when m.current_km >= coalesce(ls.general_km, 0) + s.general_service_interval_km - s.maintenance_alert_km then 'soon'
           else 'ok'
         end
  from public.motorcycles m
  join last_service ls on ls.motorcycle_id = m.id
  cross join public.settings s
  where m.status <> 'inactive'
)
select motorcycle_id, plate, current_km, service_type, next_km, next_km - current_km as km_left, status
from items
where status is not null;

grant select on public.maintenance_due to authenticated;
revoke all on public.maintenance_due from anon;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  url text,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz,
  email_sent_at timestamptz,
  unique (profile_id, dedupe_key)
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;
create policy notifications_own_select on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
revoke all on public.notifications from anon;
-- Users may only change read_at.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_own_select on public.push_subscriptions for select to authenticated
  using (profile_id = (select auth.uid()));
create policy push_own_insert on public.push_subscriptions for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy push_own_delete on public.push_subscriptions for delete to authenticated
  using (profile_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;

-- Save (or move to the current user) a push subscription.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
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

-- ---------------------------------------------------------------------------
-- Helpers to create notifications (idempotent thanks to dedupe_key)
-- ---------------------------------------------------------------------------
create or replace function public.fmt_cop(p_value bigint)
returns text
language sql immutable
set search_path = ''
as $$ select '$' || replace(to_char(coalesce(p_value, 0), 'FM999,999,999,999'), ',', '.') $$;

create or replace function public.notify(
  p_profile uuid, p_kind text, p_title text, p_body text, p_url text, p_key text
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, kind, title, body, url, dedupe_key)
  select p_profile, p_kind, p_title, p_body, p_url, p_key
  where p_profile is not null
  on conflict (profile_id, dedupe_key) do nothing
$$;

create or replace function public.notify_admins(p_kind text, p_title text, p_body text, p_url text, p_key text)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, kind, title, body, url, dedupe_key)
  select p.id, p_kind, p_title, p_body, p_url, p_key
  from public.profiles p
  where p.role = 'admin' and p.active
  on conflict (profile_id, dedupe_key) do nothing
$$;

revoke execute on function public.notify(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Event notifications: new payment / reviewed payment / new damage report
-- ---------------------------------------------------------------------------
create or replace function public.payments_notify()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_driver_profile uuid;
  v_driver_name text;
begin
  select d.profile_id, p.full_name into v_driver_profile, v_driver_name
    from public.drivers d join public.profiles p on p.id = d.profile_id
   where d.id = new.driver_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify_admins('payment_new',
      'Nuevo pago de ' || coalesce(v_driver_name, 'un conductor'),
      public.fmt_cop(new.total_amount) || ' por revisar',
      '/admin/pagos/' || new.id, 'paynew:' || new.id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public.notify(v_driver_profile, 'payment_approved', 'Pago aprobado ✅',
        'Tu pago de ' || public.fmt_cop(new.total_amount) || ' fue aprobado.',
        '/conductor', 'payok:' || new.id || ':' || extract(epoch from now())::bigint);
    elsif new.status = 'rejected' then
      perform public.notify(v_driver_profile, 'payment_rejected', 'Pago rechazado',
        'Tu pago de ' || public.fmt_cop(new.total_amount) || ' fue rechazado: ' || coalesce(new.rejection_reason, ''),
        '/conductor', 'payko:' || new.id || ':' || extract(epoch from now())::bigint);
    end if;
  end if;
  return null;
end;
$$;
create trigger payments_notify after insert or update of status on public.payments
  for each row execute function public.payments_notify();

create or replace function public.damage_reports_notify()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_plate text;
begin
  select plate into v_plate from public.motorcycles where id = new.motorcycle_id;
  perform public.notify_admins('damage_new', 'Daño reportado en ' || coalesce(v_plate, 'una moto'),
    left(new.description, 140), '/admin/danos/' || new.id, 'damage:' || new.id);
  return null;
end;
$$;
create trigger damage_reports_notify after insert on public.damage_reports
  for each row execute function public.damage_reports_notify();

revoke execute on function public.payments_notify() from public, anon, authenticated;
revoke execute on function public.damage_reports_notify() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled notifications (called every 15 minutes by the cron job)
-- ---------------------------------------------------------------------------
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
    if sm.late_days > 0 then
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
      v_label || ' ' || case when mt.status = 'overdue' then 'atrasado' else 'próximo' end || ': ' || mt.plate,
      case when mt.km_left > 0 then 'Faltan ' || mt.km_left || ' km' else 'Se pasó por ' || abs(mt.km_left) || ' km' end
        || ' (toca a los ' || mt.next_km || ' km; va en ' || mt.current_km || ' km).',
      '/admin/motos/' || mt.motorcycle_id, 'maint:' || mt.motorcycle_id || ':' || mt.service_type || ':' || mt.next_km || ':' || mt.status);
    if mt.service_type = 'oil_change' then
      select d.profile_id into v_driver_profile
        from public.contracts ct join public.drivers d on d.id = ct.driver_id
       where ct.motorcycle_id = mt.motorcycle_id and ct.status = 'active';
      perform public.notify(v_driver_profile, 'maintenance', v_label || ' ' ||
          case when mt.status = 'overdue' then 'atrasado' else 'próximo' end,
        case when mt.km_left > 0 then 'Faltan ' || mt.km_left || ' km.' else 'Ya se pasó. Hazlo cuanto antes.' end,
        '/conductor', 'maint:' || mt.motorcycle_id || ':' || mt.next_km || ':' || mt.status);
    end if;
  end loop;

  select count(*) into v_after from public.notifications;
  return v_after - v_before;
end;
$$;
revoke execute on function public.generate_notifications(timestamptz) from public, anon, authenticated;
