-- =============================================================================
-- Moto Arriendo - business logic: helpers, balance calculation, calendar,
-- payment allocation, triggers and audit log.
--
-- Balance rules (see docs/reglas-de-negocio.md):
--   chargeable days = days from contract start to the last due day, excluding
--                     rest weekdays and exempt days.
--   last due day    = today if Bogota time >= payment deadline (21:00), else yesterday.
--   expected rate   = chargeable days * daily rate
--   rate balance    = expected rate - approved rate payments (negative = paid ahead)
--   installment debt (only loans with installment_required) =
--                     min(loan amount, chargeable days since loan date * daily installment)
--                     - approved installments
--   total debt      = max(rate balance, 0) + installment debt
--   late days       = ceil(total debt / (daily rate + required daily installments))
--   light           = green (0), yellow (1 .. max_late_days-1), red (>= max_late_days)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers (security definer so they can be used inside RLS policies
-- without recursion).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.active
  )
$$;

create or replace function public.my_driver_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select d.id
  from public.drivers d
  join public.profiles p on p.id = d.profile_id
  where d.profile_id = (select auth.uid()) and p.active
  limit 1
$$;

create or replace function public.my_motorcycle_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select c.motorcycle_id
  from public.contracts c
  where c.driver_id = public.my_driver_id() and c.status = 'active'
  limit 1
$$;

-- True when running as a privileged database role (SQL editor, migrations,
-- seed scripts, server code using the secret key).
create or replace function public.is_privileged_role()
returns boolean
language sql stable
set search_path = ''
as $$ select current_user in ('postgres', 'service_role', 'supabase_admin') $$;

-- Driver accepts the personal data policy (Ley 1581 de 2012).
create or replace function public.accept_data_policy()
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  update public.profiles
     set data_consent_at = coalesce(data_consent_at, now())
   where id = (select auth.uid())
  returning data_consent_at into v_at;
  if v_at is null then
    raise exception 'Perfil no encontrado';
  end if;
  return v_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Day counting
-- ---------------------------------------------------------------------------
create or replace function public.count_chargeable_days(p_contract_id uuid, p_from date, p_to date)
returns integer
language sql stable
set search_path = public
as $$
  select count(*)::integer
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

-- ---------------------------------------------------------------------------
-- contract_summary: balance, late days and traffic light for one contract.
-- p_now can be overridden for tests.
-- ---------------------------------------------------------------------------
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

  v_total_debt := greatest(v_days_due::bigint * c.daily_rate - v_paid_rate, 0) + v_inst_debt;
  v_late := case
    when v_total_debt > 0 then ceil(v_total_debt::numeric / (c.daily_rate + v_req_inst))::integer
    else 0
  end;

  v_rate_suggest := greatest(v_days_today::bigint * c.daily_rate - v_paid_rate - v_pending_rate, 0);
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
    v_days_due::bigint * c.daily_rate,
    v_paid_rate,
    v_pending_amount,
    v_pending_count,
    v_days_due::bigint * c.daily_rate - v_paid_rate,
    v_inst_debt,
    v_loan_balance,
    v_req_inst,
    v_total_debt,
    v_late,
    case when v_late = 0 then 'green' when v_late < c.max_late_days then 'yellow' else 'red' end,
    greatest(v_days_today::bigint * c.daily_rate - v_paid_rate, 0) + v_inst_debt_today,
    v_rate_suggest + v_inst_suggest;
end;
$$;

-- ---------------------------------------------------------------------------
-- contract_calendar: one row per day with its status.
-- kind: none | rest | exempt | paid | partial | overdue | today | upcoming
-- Approved rate payments cover chargeable days in order (oldest first).
-- ---------------------------------------------------------------------------
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
  numbered as (
    select cl.d, cl.k, cl.reason,
           case when cl.k = 'chargeable'
                then row_number() over (partition by cl.k order by cl.d) end as n
    from classified cl
  )
  select n.d,
    case
      when n.k <> 'chargeable' then n.k
      when v_paid >= n.n * c.daily_rate then 'paid'
      when v_paid > (n.n - 1) * c.daily_rate then 'partial'
      when n.d <= v_last_due then 'overdue'
      when n.d = v_today then 'today'
      else 'upcoming'
    end,
    case when n.k = 'chargeable'
         then least(greatest(v_paid - (n.n - 1) * c.daily_rate, 0), c.daily_rate)::integer
         else 0 end,
    n.reason
  from numbered n
  where n.d >= p_from
  order by n.d;
end;
$$;

-- ---------------------------------------------------------------------------
-- allocate_payment: split a total amount between the daily fee and the loan.
-- 1) the fee owed through today (approved + pending payments considered),
--    or one day's fee if nothing is owed;
-- 2) the rest goes to the oldest active loan (up to its remaining balance);
-- 3) anything left is an advance on future daily fees.
-- ---------------------------------------------------------------------------
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

  v_rate_due := greatest(
    public.count_chargeable_days(c.id, c.start_date, v_today)::bigint * c.daily_rate - v_rate_paid, 0);
  if v_rate_due = 0 then
    v_rate_due := c.daily_rate;
  end if;
  v_rate := least(p_total::bigint, v_rate_due)::integer;

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

-- ---------------------------------------------------------------------------
-- Loan status refresh (paid when approved installments cover the amount)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_loan_status(p_loan_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  update public.loans lo
     set status = case
       when lo.amount - coalesce((select sum(p.installment_amount) from public.payments p
                                   where p.loan_id = lo.id and p.status = 'approved'), 0) <= 0
       then 'paid'::public.loan_status
       else 'active'::public.loan_status
     end
   where lo.id = p_loan_id
$$;
revoke execute on function public.refresh_loan_status(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- payments triggers
-- ---------------------------------------------------------------------------
create or replace function public.payments_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c public.contracts%rowtype;
  a record;
  v_admin boolean := public.is_admin() or public.is_privileged_role();
begin
  select * into c from public.contracts where id = new.contract_id;
  if not found then
    raise exception 'Contrato no encontrado';
  end if;

  new.driver_id := c.driver_id;
  new.motorcycle_id := c.motorcycle_id;
  new.created_by := coalesce(auth.uid(), new.created_by);

  if not v_admin then
    if c.driver_id is distinct from public.my_driver_id() then
      raise exception 'No autorizado';
    end if;
    if c.status <> 'active' then
      raise exception 'El contrato no está vigente';
    end if;
    if new.paid_on > public.bogota_today() or new.paid_on < public.bogota_today() - 30 then
      raise exception 'La fecha del pago no es válida';
    end if;
    if new.receipt_path is null and new.method <> 'cash' then
      raise exception 'Debes adjuntar el comprobante';
    end if;
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
    -- The split is always computed by the database for drivers.
    select * into a from public.allocate_payment(c.id, new.total_amount);
    new.rate_amount := a.rate_amount;
    new.installment_amount := a.installment_amount;
    new.loan_id := a.loan_id;
  else
    if coalesce(new.rate_amount, 0) + coalesce(new.installment_amount, 0) <> new.total_amount then
      select * into a from public.allocate_payment(c.id, new.total_amount);
      new.rate_amount := a.rate_amount;
      new.installment_amount := a.installment_amount;
      new.loan_id := a.loan_id;
    end if;
    if new.status in ('approved', 'rejected') then
      new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
      new.reviewed_at := coalesce(new.reviewed_at, now());
    end if;
  end if;

  if new.installment_amount = 0 then
    new.loan_id := null;
  end if;
  if new.loan_id is not null and not exists (
    select 1 from public.loans lo where lo.id = new.loan_id and lo.driver_id = c.driver_id
  ) then
    raise exception 'El préstamo no corresponde al conductor';
  end if;
  return new;
end;
$$;

create trigger payments_before_insert
before insert on public.payments
for each row execute function public.payments_before_insert();

create or replace function public.payments_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;
  -- Ownership fields never change.
  new.contract_id := old.contract_id;
  new.driver_id := old.driver_id;
  new.motorcycle_id := old.motorcycle_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if new.status is distinct from old.status then
    if new.status in ('approved', 'rejected') then
      new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
      new.reviewed_at := now();
    else
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
  end if;
  if new.status <> 'rejected' then
    new.rejection_reason := null;
  end if;
  if new.installment_amount = 0 then
    new.loan_id := null;
  end if;
  if new.loan_id is not null and not exists (
    select 1 from public.loans lo where lo.id = new.loan_id and lo.driver_id = new.driver_id
  ) then
    raise exception 'El préstamo no corresponde al conductor';
  end if;
  return new;
end;
$$;

create trigger payments_before_update
before update on public.payments
for each row execute function public.payments_before_update();

create or replace function public.payments_after_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.loan_id is not null then
    perform public.refresh_loan_status(old.loan_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.loan_id is not null then
    perform public.refresh_loan_status(new.loan_id);
  end if;
  return null;
end;
$$;

create trigger payments_after_change
after insert or update or delete on public.payments
for each row execute function public.payments_after_change();

-- Loans: when the amount changes, recompute status.
create or replace function public.loans_after_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.amount is distinct from old.amount then
    perform public.refresh_loan_status(new.id);
  end if;
  return null;
end;
$$;

create trigger loans_after_update
after update of amount on public.loans
for each row execute function public.loans_after_update();

-- ---------------------------------------------------------------------------
-- inspections / damage reports / documents: fill ownership for drivers
-- ---------------------------------------------------------------------------
create or replace function public.driver_owned_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_driver uuid;
  v_contract public.contracts%rowtype;
begin
  if public.is_admin() or public.is_privileged_role() then
    return new;
  end if;
  v_driver := public.my_driver_id();
  if v_driver is null then
    raise exception 'No autorizado';
  end if;

  if tg_table_name in ('inspections', 'damage_reports') then
    select * into v_contract from public.contracts c
     where c.driver_id = v_driver and c.status = 'active' limit 1;
    if not found then
      raise exception 'No tienes un contrato vigente';
    end if;
    new.driver_id := v_driver;
    new.motorcycle_id := v_contract.motorcycle_id;
    if tg_table_name = 'inspections' then
      new.contract_id := v_contract.id;
      new.inspected_on := public.bogota_today();
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_notes := null;
    else
      new.reported_on := public.bogota_today();
      new.status := 'open';
      new.closed_by := null;
      new.closed_at := null;
      new.resolution_notes := null;
    end if;
  elsif tg_table_name = 'documents' then
    if new.entity <> 'driver' or new.driver_id is distinct from v_driver then
      raise exception 'Solo puedes subir tus propios documentos';
    end if;
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger inspections_before_insert
before insert on public.inspections
for each row execute function public.driver_owned_before_insert();

create trigger damage_reports_before_insert
before insert on public.damage_reports
for each row execute function public.driver_owned_before_insert();

create trigger documents_before_insert
before insert on public.documents
for each row execute function public.driver_owned_before_insert();

-- Keep the motorcycle odometer up to date from inspections.
create or replace function public.inspections_after_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.motorcycles
     set current_km = greatest(current_km, new.km)
   where id = new.motorcycle_id;
  return null;
end;
$$;

create trigger inspections_after_insert
after insert on public.inspections
for each row execute function public.inspections_after_insert();

-- Damage reports: stamp who closed it.
create or replace function public.damage_reports_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'closed' then
      new.closed_by := coalesce(auth.uid(), new.closed_by);
      new.closed_at := now();
    else
      new.closed_by := null;
      new.closed_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger damage_reports_before_update
before update on public.damage_reports
for each row execute function public.damage_reports_before_update();

-- Inspections: stamp who reviewed it.
create or replace function public.inspections_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reviewed_at is distinct from old.reviewed_at and new.reviewed_at is not null then
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
  end if;
  return new;
end;
$$;

create trigger inspections_before_update
before update on public.inspections
for each row execute function public.inspections_before_update();

-- ---------------------------------------------------------------------------
-- Audit log trigger
-- ---------------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_action text := lower(tg_op);
  v_details jsonb;
begin
  if tg_op = 'DELETE' then
    v_id := old.id;
    v_details := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'INSERT' then
    v_id := new.id;
    v_details := jsonb_build_object('new', to_jsonb(new));
  else
    v_id := new.id;
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_details
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n using (key)
     where o.value is distinct from n.value;
    if v_details is null then
      return null;
    end if;
    if tg_table_name = 'payments' and v_details ? 'status' then
      v_action := 'payment_' || (to_jsonb(new) ->> 'status');
    end if;
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), v_action, tg_table_name, v_id, v_details);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'drivers', 'motorcycles', 'documents', 'contracts', 'loans',
    'payments', 'exempt_days', 'inspections', 'damage_reports', 'settings'
  ] loop
    if t = 'settings' then
      continue;
    end if;
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()',
      t || '_audit', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Views (security_invoker = RLS of the caller applies)
-- ---------------------------------------------------------------------------
create view public.loan_balances
with (security_invoker = true) as
select
  lo.*,
  coalesce(pa.paid, 0)::bigint as paid_amount,
  coalesce(pa.pending, 0)::bigint as pending_amount,
  (lo.amount - coalesce(pa.paid, 0))::bigint as balance
from public.loans lo
left join lateral (
  select sum(p.installment_amount) filter (where p.status = 'approved') as paid,
         sum(p.installment_amount) filter (where p.status = 'pending') as pending
  from public.payments p
  where p.loan_id = lo.id
) pa on true;

create view public.contract_overview
with (security_invoker = true) as
select
  c.id,
  c.status,
  c.start_date,
  c.end_date,
  c.rest_weekdays,
  c.payment_deadline,
  c.driver_id,
  pr.full_name as driver_name,
  pr.phone as driver_phone,
  c.motorcycle_id,
  m.plate,
  m.owner_id,
  op.full_name as owner_name,
  s.daily_rate,
  s.max_late_days,
  s.today_kind,
  s.chargeable_days,
  s.expected_rate,
  s.paid_rate,
  s.pending_amount,
  s.pending_count,
  s.rate_balance,
  s.installment_debt,
  s.loan_balance,
  s.total_debt,
  s.late_days,
  s.light,
  s.due_today,
  s.suggested_payment
from public.contracts c
join public.drivers d on d.id = c.driver_id
join public.profiles pr on pr.id = d.profile_id
join public.motorcycles m on m.id = c.motorcycle_id
left join public.profiles op on op.id = m.owner_id
cross join lateral public.contract_summary(c.id) s;

-- Latest expiry per document type + driver license dates + first technical
-- inspection due date for motorcycles without one (2 years after purchase).
create view public.document_expirations
with (security_invoker = true) as
with latest as (
  select distinct on (d.entity, coalesce(d.motorcycle_id, d.driver_id), d.doc_type)
    d.id as document_id, d.entity, d.motorcycle_id, d.driver_id, d.doc_type, d.expires_on
  from public.documents d
  where d.expires_on is not null
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

-- Weekly inspection status per active contract.
create view public.inspection_status
with (security_invoker = true) as
select
  c.id as contract_id,
  c.driver_id,
  c.motorcycle_id,
  w.week_start,
  (select max(i.inspected_on) from public.inspections i
    where i.driver_id = c.driver_id and i.motorcycle_id = c.motorcycle_id) as last_inspection_on,
  exists (select 1 from public.inspections i
           where i.driver_id = c.driver_id and i.motorcycle_id = c.motorcycle_id
             and i.inspected_on >= w.week_start) as done_this_week,
  (c.start_date <= w.week_start) as required_this_week
from public.contracts c
cross join public.settings s
cross join lateral (
  select public.bogota_today()
         - ((extract(dow from public.bogota_today())::integer - s.inspection_weekday + 7) % 7) as week_start
) w
where c.status = 'active';
