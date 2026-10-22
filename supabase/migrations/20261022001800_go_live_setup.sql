-- =============================================================================
-- Go-live setup (22/10/2026)
--  A. Drivers can sign in with a username (e.g. "hamer") or their phone.
--     Passwords assigned by the admin can be short (min 4); the driver must
--     choose their own on the first sign-in.
--  B. First sign-in: the driver fills in their own data (cédula, phone,
--     license, emergency contact) before using the app.
--  C. "Pendientes por llenar": what the admin still has to set up (motorcycle,
--     contract and dates, documents) — a checklist on "Hoy" and weekly notices.
--  D. The daily rate can change from a given date without rewriting what was
--     already owed (contract_rates). Loan defaults live in Configuración.
-- =============================================================================

-- A) Accounts --------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists onboarded_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[a-z][a-z0-9._-]{2,29}$');
  end if;
end $$;
create unique index if not exists profiles_username_key on public.profiles (username) where username is not null;

-- Drivers created by the admin may not have a cédula yet: they fill it in.
alter table public.drivers alter column national_id drop not null;

create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role public.user_role,
  p_phone text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correo inválido';
  end if;
  if length(coalesce(p_password, '')) < 4 then
    raise exception 'La contraseña debe tener al menos 4 caracteres';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Ya existe un usuario con ese correo o celular';
  end if;
  if p_phone is not null and exists (select 1 from public.profiles p where p.phone = p_phone) then
    raise exception 'Ya existe un usuario con ese celular';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name), now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, full_name, phone, email, role)
  values (v_id, trim(p_full_name), p_phone, v_email, p_role);

  return v_id;
end;
$$;


create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;
  if length(coalesce(p_password, '')) < 4 then
    raise exception 'La contraseña debe tener al menos 4 caracteres';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
  -- A driver must replace a password chosen by someone else.
  update public.profiles set must_change_password = true where id = p_user_id and role = 'driver';
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'password_reset', 'profiles', p_user_id, null);
end;
$$;

-- Creates a driver account with a username and/or phone. Everything else is
-- optional: the driver completes it on the first sign-in.
create or replace function public.admin_create_driver_account(
  p_full_name text,
  p_username text,
  p_phone text,
  p_password text,
  p_national_id text default null,
  p_license_number text default null,
  p_license_category text default null,
  p_license_expires_on date default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_referred_by text default null,
  p_deposit_amount integer default 0,
  p_notes text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_username text := nullif(lower(trim(coalesce(p_username, ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_national text := nullif(trim(coalesce(p_national_id, '')), '');
  v_user uuid;
  v_driver uuid;
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Escribe el nombre del conductor';
  end if;
  if v_username is null and v_phone is null then
    raise exception 'Escribe un usuario o un celular para que pueda entrar';
  end if;
  if v_username is not null and v_username !~ '^[a-z][a-z0-9._-]{2,29}$' then
    raise exception 'El usuario debe empezar por una letra y tener de 3 a 30 letras o números, sin espacios';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9]{10}$' then
    raise exception 'El celular debe tener 10 dígitos';
  end if;
  if v_username is not null and exists (select 1 from public.profiles where username = v_username) then
    raise exception 'Ya existe un conductor con ese usuario';
  end if;
  if v_national is not null and exists (select 1 from public.drivers where national_id = v_national) then
    raise exception 'Ya existe un conductor con esa cédula';
  end if;

  v_user := public.admin_create_user(
    coalesce(v_username, v_phone) || '@conductores.moto-arriendo.app', p_password, trim(p_full_name), 'driver', v_phone);
  update public.profiles set username = v_username, must_change_password = true where id = v_user;

  insert into public.drivers (
    profile_id, national_id, license_number, license_category, license_expires_on,
    emergency_contact_name, emergency_contact_phone, referred_by, deposit_amount, notes
  ) values (
    v_user, v_national, nullif(trim(p_license_number), ''), nullif(trim(p_license_category), ''),
    p_license_expires_on, nullif(trim(p_emergency_contact_name), ''), nullif(trim(p_emergency_contact_phone), ''),
    nullif(trim(p_referred_by), ''), coalesce(p_deposit_amount, 0), nullif(trim(p_notes), '')
  )
  returning id into v_driver;
  return v_driver;
end;
$$;
revoke execute on function public.admin_create_driver_account(text, text, text, text, text, text, text, date, text, text, text, integer, text) from public, anon;
grant execute on function public.admin_create_driver_account(text, text, text, text, text, text, text, date, text, text, text, integer, text) to authenticated;

-- B) First sign-in -----------------------------------------------------------------
-- The driver fills in their own data. Phone-login accounts keep their phone
-- (it is their username).
create or replace function public.complete_driver_onboarding(
  p_full_name text,
  p_phone text,
  p_national_id text,
  p_license_number text,
  p_license_category text,
  p_license_expires_on date,
  p_emergency_contact_name text,
  p_emergency_contact_phone text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_driver uuid := public.my_driver_id();
  v_profile public.profiles%rowtype;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_em_phone text := regexp_replace(coalesce(p_emergency_contact_phone, ''), '\D', '', 'g');
  v_national text := regexp_replace(coalesce(p_national_id, ''), '[^0-9A-Za-z]', '', 'g');
begin
  if v_driver is null then
    raise exception 'No autorizado';
  end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.username is null then
    v_phone := v_profile.phone; -- phone is the login: it cannot change here
  end if;
  if length(trim(coalesce(p_full_name, ''))) < 5 then
    raise exception 'Escribe tu nombre completo';
  end if;
  if v_phone !~ '^3[0-9]{9}$' then
    raise exception 'Tu celular debe tener 10 dígitos y empezar por 3';
  end if;
  if exists (select 1 from public.profiles where phone = v_phone and id <> auth.uid()) then
    raise exception 'Ese celular ya está registrado con otra cuenta';
  end if;
  if length(v_national) < 5 or length(v_national) > 15 then
    raise exception 'Revisa tu número de cédula';
  end if;
  if exists (select 1 from public.drivers where national_id = v_national and id <> v_driver) then
    raise exception 'Esa cédula ya está registrada con otra cuenta';
  end if;
  if length(trim(coalesce(p_license_number, ''))) < 4 then
    raise exception 'Escribe el número de tu licencia de conducción';
  end if;
  if coalesce(p_license_category, '') not in ('A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3') then
    raise exception 'Elige la categoría de tu licencia';
  end if;
  if p_license_expires_on is null or p_license_expires_on < public.bogota_today() then
    raise exception 'La fecha de vencimiento de la licencia no es válida (debe estar vigente)';
  end if;
  if length(trim(coalesce(p_emergency_contact_name, ''))) < 3 then
    raise exception 'Escribe el nombre de tu contacto de emergencia';
  end if;
  if v_em_phone !~ '^[0-9]{7,10}$' then
    raise exception 'Revisa el teléfono de tu contacto de emergencia';
  end if;
  if v_em_phone = v_phone then
    raise exception 'El contacto de emergencia debe tener otro número distinto al tuyo';
  end if;

  update public.drivers
     set national_id = v_national,
         license_number = trim(p_license_number),
         license_category = p_license_category,
         license_expires_on = p_license_expires_on,
         emergency_contact_name = trim(p_emergency_contact_name),
         emergency_contact_phone = v_em_phone
   where id = v_driver;
  update public.profiles
     set full_name = trim(p_full_name), phone = v_phone, onboarded_at = now()
   where id = auth.uid();
end;
$$;
revoke execute on function public.complete_driver_onboarding(text, text, text, text, text, date, text, text) from public, anon;
grant execute on function public.complete_driver_onboarding(text, text, text, text, text, date, text, text) to authenticated;

-- Called right after the driver sets their own password.
create or replace function public.mark_password_changed()
returns void
language sql security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = auth.uid()
$$;
revoke execute on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;

-- D) Rates that change over time ---------------------------------------------------
create table if not exists public.contract_rates (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  effective_from date not null,
  daily_rate integer not null check (daily_rate between 1000 and 1000000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (contract_id, effective_from)
);
alter table public.contract_rates enable row level security;
create policy contract_rates_admin_all on public.contract_rates for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy contract_rates_driver_select on public.contract_rates for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and c.driver_id = (select public.my_driver_id())));
revoke all on public.contract_rates from anon;

-- Rate in force on a day: the latest change on or before it, else the
-- contract's rate (contracts without changes).
create or replace function public.rate_on(p_contract_id uuid, p_day date)
returns integer
language sql stable
set search_path = public
as $$
  select coalesce(
    (select r.daily_rate from public.contract_rates r
      where r.contract_id = p_contract_id and r.effective_from <= p_day
      order by r.effective_from desc limit 1),
    (select c.daily_rate from public.contracts c where c.id = p_contract_id))
$$;

-- Sum of the rates of every chargeable day in a range.
create or replace function public.expected_rate(p_contract_id uuid, p_from date, p_to date)
returns bigint
language sql stable
set search_path = public
as $$
  select coalesce(sum(public.rate_on(c.id, g.d::date)), 0)::bigint
  from public.contracts c
  cross join lateral generate_series(
    greatest(p_from, c.start_date)::timestamp,
    least(p_to, coalesce(c.end_date, p_to))::timestamp,
    interval '1 day'
  ) as g(d)
  where c.id = p_contract_id
    and not (extract(dow from g.d)::smallint = any (c.rest_weekdays))
    and not exists (
      select 1 from public.exempt_days e
      where e.contract_id = c.id and e.day = g.d::date
    )
$$;
grant execute on function public.rate_on(uuid, date), public.expected_rate(uuid, date, date) to authenticated;
revoke execute on function public.rate_on(uuid, date), public.expected_rate(uuid, date, date) from anon;

-- Change the daily rate from a date on (past days keep the old rate).
create or replace function public.admin_change_contract_rate(p_contract_id uuid, p_from date, p_rate integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.contracts%rowtype;
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;
  select * into c from public.contracts where id = p_contract_id;
  if not found then
    raise exception 'Contrato no encontrado';
  end if;
  if p_rate is null or p_rate < 1000 or p_rate > 1000000 then
    raise exception 'La tarifa debe estar entre $1.000 y $1.000.000';
  end if;
  if p_from is null or p_from < c.start_date then
    raise exception 'La fecha debe ser igual o posterior al inicio del contrato (%)', to_char(c.start_date, 'DD/MM/YYYY');
  end if;
  -- Keep the original rate as the first period.
  insert into public.contract_rates (contract_id, effective_from, daily_rate)
  values (c.id, c.start_date, c.daily_rate)
  on conflict (contract_id, effective_from) do nothing;
  insert into public.contract_rates (contract_id, effective_from, daily_rate)
  values (c.id, p_from, p_rate)
  on conflict (contract_id, effective_from) do update set daily_rate = excluded.daily_rate, created_by = auth.uid(), created_at = now();
  -- contracts.daily_rate = the rate in force today (shown everywhere).
  update public.contracts set daily_rate = public.rate_on(c.id, public.bogota_today()) where id = c.id;
end;
$$;
revoke execute on function public.admin_change_contract_rate(uuid, date, integer) from public, anon;
grant execute on function public.admin_change_contract_rate(uuid, date, integer) to authenticated;

create or replace function public.contract_summary(p_contract_id uuid, p_now timestamptz default now())
returns table (
  contract_id uuid,
  driver_id uuid,
  motorcycle_id uuid,
  daily_rate integer,
  max_late_days integer,
  today date,
  last_due_date date,
  today_kind text,
  chargeable_days integer,
  expected_rate bigint,
  paid_rate bigint,
  pending_amount bigint,
  pending_count integer,
  rate_balance bigint,
  installment_debt bigint,
  loan_balance bigint,
  required_daily_installment integer,
  total_debt bigint,
  late_days integer,
  light text,
  due_today bigint,
  suggested_payment bigint
)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
declare
  c public.contracts%rowtype;
  v_local timestamp := p_now at time zone 'America/Bogota';
  v_today date := (p_now at time zone 'America/Bogota')::date;
  v_last_due date;
  v_days_due integer;
  v_days_today integer;
  v_paid_rate bigint;
  v_pending_rate bigint;
  v_pending_amount bigint;
  v_pending_count integer;
  v_inst_debt bigint := 0;
  v_inst_debt_today bigint := 0;
  v_inst_suggest bigint := 0;
  v_loan_balance bigint := 0;
  v_req_inst integer := 0;
  v_rate_suggest bigint;
  v_total_debt bigint;
  v_late integer;
  v_kind text;
  v_expected_due bigint;
  v_expected_today bigint;
  l record;
  v_loan_days_due integer;
  v_loan_days_today integer;
begin
  select * into c from public.contracts where id = p_contract_id;
  if not found then
    return;
  end if;

  v_last_due := case when v_local::time >= c.payment_deadline then v_today else v_today - 1 end;
  v_days_due := public.count_chargeable_days(c.id, c.start_date, v_last_due);
  v_days_today := public.count_chargeable_days(c.id, c.start_date, v_today);
  -- Each day is charged at the rate in force that day (see contract_rates).
  v_expected_due := public.expected_rate(c.id, c.start_date, v_last_due);
  v_expected_today := public.expected_rate(c.id, c.start_date, v_today);

  select coalesce(sum(p.rate_amount) filter (where p.status = 'approved'), 0),
         coalesce(sum(p.rate_amount) filter (where p.status = 'pending'), 0),
         coalesce(sum(p.total_amount) filter (where p.status = 'pending'), 0),
         count(*) filter (where p.status = 'pending')
    into v_paid_rate, v_pending_rate, v_pending_amount, v_pending_count
    from public.payments p
   where p.contract_id = c.id;

  for l in
    select lo.id, lo.amount, lo.daily_installment, lo.installment_required, lo.loan_date,
           coalesce((select sum(p.installment_amount) from public.payments p
                      where p.loan_id = lo.id and p.status = 'approved'), 0) as paid,
           coalesce((select sum(p.installment_amount) from public.payments p
                      where p.loan_id = lo.id and p.status = 'pending'), 0) as pending
      from public.loans lo
     where lo.driver_id = c.driver_id and lo.status = 'active'
  loop
    v_loan_balance := v_loan_balance + greatest(l.amount - l.paid, 0);
    v_loan_days_due := public.count_chargeable_days(c.id, greatest(l.loan_date, c.start_date), v_last_due);
    v_loan_days_today := public.count_chargeable_days(c.id, greatest(l.loan_date, c.start_date), v_today);
    if l.installment_required then
      v_req_inst := v_req_inst + l.daily_installment;
      v_inst_debt := v_inst_debt
        + greatest(least(l.amount::bigint, l.daily_installment::bigint * v_loan_days_due) - l.paid, 0);
      v_inst_debt_today := v_inst_debt_today
        + greatest(least(l.amount::bigint, l.daily_installment::bigint * v_loan_days_today) - l.paid, 0);
      v_inst_suggest := v_inst_suggest + least(
        greatest(l.amount - l.paid - l.pending, 0),
        greatest(
          least(l.amount::bigint, l.daily_installment::bigint * v_loan_days_today) - l.paid - l.pending,
          l.daily_installment
        )
      );
    else
      v_inst_suggest := v_inst_suggest + least(greatest(l.amount - l.paid - l.pending, 0), l.daily_installment);
    end if;
  end loop;

  v_total_debt := greatest(v_expected_due - v_paid_rate, 0) + v_inst_debt;
  v_late := case
    when v_total_debt > 0 then ceil(v_total_debt::numeric / (c.daily_rate + v_req_inst))::integer
    else 0
  end;

  v_rate_suggest := greatest(v_expected_today - v_paid_rate - v_pending_rate, 0);
  if v_rate_suggest = 0 then
    v_rate_suggest := c.daily_rate;
  end if;

  v_kind := case
    when v_today < c.start_date or (c.end_date is not null and v_today > c.end_date) then 'none'
    when extract(dow from v_today)::smallint = any (c.rest_weekdays) then 'rest'
    when exists (select 1 from public.exempt_days e where e.contract_id = c.id and e.day = v_today) then 'exempt'
    else 'chargeable'
  end;

  return query select
    c.id,
    c.driver_id,
    c.motorcycle_id,
    c.daily_rate,
    c.max_late_days,
    v_today,
    v_last_due,
    v_kind,
    v_days_due,
    v_expected_due,
    v_paid_rate,
    v_pending_amount,
    v_pending_count,
    v_expected_due - v_paid_rate,
    v_inst_debt,
    v_loan_balance,
    v_req_inst,
    v_total_debt,
    v_late,
    case when v_late = 0 then 'green' when v_late < c.max_late_days then 'yellow' else 'red' end,
    greatest(v_expected_today - v_paid_rate, 0) + v_inst_debt_today,
    v_rate_suggest + v_inst_suggest;
end;
$$;

create or replace function public.contract_calendar(
  p_contract_id uuid,
  p_from date,
  p_to date,
  p_now timestamptz default now()
)
returns table (day date, kind text, amount_covered integer, exempt_reason text)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
declare
  c public.contracts%rowtype;
  v_local timestamp := p_now at time zone 'America/Bogota';
  v_today date := (p_now at time zone 'America/Bogota')::date;
  v_last_due date;
  v_paid bigint;
begin
  select * into c from public.contracts where id = p_contract_id;
  if not found or p_to < p_from or p_to - p_from > 400 then
    return;
  end if;
  v_last_due := case when v_local::time >= c.payment_deadline then v_today else v_today - 1 end;
  select coalesce(sum(p.rate_amount), 0) into v_paid
    from public.payments p
   where p.contract_id = c.id and p.status = 'approved';

  return query
  with days as (
    select g::date as d
    from generate_series(least(p_from, c.start_date)::timestamp, p_to::timestamp, interval '1 day') g
  ),
  classified as (
    select days.d,
      case
        when days.d < c.start_date or (c.end_date is not null and days.d > c.end_date) then 'none'
        when extract(dow from days.d)::smallint = any (c.rest_weekdays) then 'rest'
        when ex.reason is not null then 'exempt'
        else 'chargeable'
      end as k,
      ex.reason
    from days
    left join public.exempt_days ex on ex.contract_id = c.id and ex.day = days.d
  ),
  rated as (
    select cl.d, cl.k, cl.reason,
           case when cl.k = 'chargeable' then public.rate_on(c.id, cl.d) else 0 end as r
    from classified cl
  ),
  numbered as (
    -- cum = everything owed up to and including this day (rates can change)
    select rt.d, rt.k, rt.reason, rt.r,
           sum(rt.r) over (order by rt.d rows between unbounded preceding and current row) as cum
    from rated rt
  )
  select n.d,
    case
      when n.k <> 'chargeable' then n.k
      when v_paid >= n.cum then 'paid'
      when v_paid > n.cum - n.r then 'partial'
      when n.d <= v_last_due then 'overdue'
      when n.d = v_today then 'today'
      else 'upcoming'
    end,
    case when n.k = 'chargeable'
         then least(greatest(v_paid - (n.cum - n.r), 0), n.r)::integer
         else 0 end,
    n.reason
  from numbered n
  where n.d >= p_from
  order by n.d;
end;
$$;

create or replace function public.allocate_payment(
  p_contract_id uuid,
  p_total integer,
  p_exclude_payment uuid default null,
  p_now timestamptz default now()
)
returns table (rate_amount integer, installment_amount integer, loan_id uuid)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
declare
  c public.contracts%rowtype;
  v_today date := (p_now at time zone 'America/Bogota')::date;
  v_rate_paid bigint;
  v_rate_due bigint;
  v_rate integer;
  v_inst integer := 0;
  v_loan uuid;
  v_remaining bigint;
begin
  select * into c from public.contracts where id = p_contract_id;
  if not found then
    raise exception 'Contrato no encontrado';
  end if;

  select coalesce(sum(p.rate_amount), 0) into v_rate_paid
    from public.payments p
   where p.contract_id = c.id
     and p.status in ('approved', 'pending')
     and (p_exclude_payment is null or p.id <> p_exclude_payment);

  v_rate_due := greatest(public.expected_rate(c.id, c.start_date, v_today) - v_rate_paid, 0);
  if v_rate_due = 0 then
    v_rate_due := c.daily_rate;
  end if;
  v_rate := least(p_total::bigint, v_rate_due)::integer;

  -- One active loan per driver (unique index), so "the" active loan.
  select lo.id,
         lo.amount - coalesce((select sum(p.installment_amount) from public.payments p
                                where p.loan_id = lo.id and p.status in ('approved', 'pending')
                                  and (p_exclude_payment is null or p.id <> p_exclude_payment)), 0)
    into v_loan, v_remaining
    from public.loans lo
   where lo.driver_id = c.driver_id and lo.status = 'active'
   order by lo.loan_date, lo.created_at
   limit 1;

  if v_loan is not null and v_remaining > 0 then
    v_inst := least((p_total - v_rate)::bigint, v_remaining)::integer;
  end if;

  return query select p_total - v_inst, v_inst, case when v_inst > 0 then v_loan end;
end;
$$;


-- Loan defaults (Configuración) -----------------------------------------------------
alter table public.settings
  add column if not exists default_loan_concept text not null default 'Pase A2',
  add column if not exists default_installment_required boolean not null default true;

-- C) What the admin still has to fill in ---------------------------------------------
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
  -- Contracts without the signed document
  select 'contract_file', c.id, 'Falta subir el contrato firmado de ' || p.full_name,
         'Sube el PDF o una foto del contrato firmado.', '/admin/contratos/' || c.id
    from public.contracts c join public.drivers d on d.id = c.driver_id join public.profiles p on p.id = d.profile_id
   where (public.is_admin() or public.is_privileged_role()) and c.status = 'active' and c.file_path is null
$$;
revoke execute on function public.setup_pending() from public, anon;
grant execute on function public.setup_pending() to authenticated;

-- Weekly reminders of what is still pending to fill in.
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

  select count(*) into v_after from public.notifications;
  return v_after - v_before;
end;
$$;
revoke execute on function public.generate_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.generate_notifications(timestamptz) to service_role;

-- Create the "📝 Falta…" notices right away when a driver or motorcycle is added
-- (instead of waiting up to 15 minutes for the scheduled run).
create or replace function public.refresh_setup_notices()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.generate_notifications();
  return null;
end;
$$;
revoke execute on function public.refresh_setup_notices() from public, anon, authenticated;
create or replace trigger drivers_setup_notices after insert on public.drivers
  for each statement execute function public.refresh_setup_notices();
create or replace trigger motorcycles_setup_notices after insert on public.motorcycles
  for each statement execute function public.refresh_setup_notices();
create or replace trigger contracts_setup_notices after insert on public.contracts
  for each statement execute function public.refresh_setup_notices();
