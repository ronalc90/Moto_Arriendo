-- =============================================================================
-- Phase 3: incidents (accidents, fines, impounds, theft), expenses and
-- financial reports per motorcycle / owner (income, costs, net, payback).
-- =============================================================================

create type public.incident_kind as enum ('accident', 'fine', 'impound', 'theft', 'other');
create type public.responsible_party as enum ('driver', 'owner', 'third_party', 'insurer', 'pending');
create type public.incident_status as enum ('open', 'closed');

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles (id) on delete cascade,
  driver_id uuid references public.drivers (id),
  kind public.incident_kind not null,
  occurred_on date not null default public.bogota_today(),
  description text not null check (length(trim(description)) > 3),
  responsible public.responsible_party not null default 'pending',
  cost integer not null default 0 check (cost >= 0),
  paid_by public.responsible_party not null default 'pending',
  reference text, -- fine number, police report, claim number...
  files text[] not null default '{}',
  status public.incident_status not null default 'open',
  resolution_notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index incidents_moto_idx on public.incidents (motorcycle_id, occurred_on desc);

alter table public.incidents enable row level security;
create policy incidents_admin_all on public.incidents for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy incidents_driver_select on public.incidents for select to authenticated
  using (driver_id = (select public.my_driver_id()));
revoke all on public.incidents from anon;
create trigger incidents_audit after insert or update or delete on public.incidents
  for each row execute function public.audit_trigger();

-- When an impound/theft is registered, mark the motorcycle accordingly.
create or replace function public.incidents_after_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.kind = 'impound' and new.status = 'open' then
    update public.motorcycles set status = 'impounded' where id = new.motorcycle_id;
  end if;
  return null;
end;
$$;
create trigger incidents_after_insert after insert on public.incidents
  for each row execute function public.incidents_after_insert();
revoke execute on function public.incidents_after_insert() from public, anon, authenticated;

-- Other owner expenses: SOAT, insurance, GPS, taxes, technical inspection...
create type public.expense_category as enum (
  'soat', 'insurance', 'tech_inspection', 'gps', 'tax', 'maintenance', 'repair', 'fine', 'other'
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles (id) on delete cascade,
  category public.expense_category not null,
  spent_on date not null default public.bogota_today(),
  amount integer not null check (amount > 0),
  description text,
  file_path text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index expenses_moto_idx on public.expenses (motorcycle_id, spent_on desc);
alter table public.expenses enable row level security;
create policy expenses_admin_all on public.expenses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.expenses from anon;
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.audit_trigger();

-- All owner costs in one place (no double counting: maintenance and incidents
-- count only when the owner paid; general expenses always).
create view public.motorcycle_costs
with (security_invoker = true) as
select e.motorcycle_id, e.spent_on as cost_date, e.category::text as category, e.amount,
       coalesce(e.description, '') as description, 'expense'::text as source, e.id as source_id
from public.expenses e
union all
select r.motorcycle_id, r.performed_on,
       case when r.service_type = 'repair' then 'repair' else 'maintenance' end,
       r.cost, coalesce(r.description, r.service_type::text), 'maintenance', r.id
from public.maintenance_records r
where r.paid_by = 'owner' and r.cost > 0
union all
select i.motorcycle_id, i.occurred_on,
       case when i.kind = 'fine' then 'fine' else 'repair' end,
       i.cost, i.description, 'incident', i.id
from public.incidents i
where i.paid_by = 'owner' and i.cost > 0;

-- Monthly finance per motorcycle.
create view public.finance_monthly
with (security_invoker = true) as
with income as (
  select p.motorcycle_id, date_trunc('month', p.paid_on)::date as month,
         sum(p.rate_amount)::bigint as income, sum(p.installment_amount)::bigint as installments
  from public.payments p
  where p.status = 'approved'
  group by 1, 2
),
costs as (
  select c.motorcycle_id, date_trunc('month', c.cost_date)::date as month, sum(c.amount)::bigint as costs
  from public.motorcycle_costs c
  group by 1, 2
),
months as (
  select motorcycle_id, month from income
  union
  select motorcycle_id, month from costs
)
select mo.motorcycle_id, m.plate, m.owner_id, mo.month,
       coalesce(i.income, 0) as income,
       coalesce(i.installments, 0) as installments,
       coalesce(c.costs, 0) as costs,
       coalesce(i.income, 0) - coalesce(c.costs, 0) as net
from months mo
join public.motorcycles m on m.id = mo.motorcycle_id
left join income i on i.motorcycle_id = mo.motorcycle_id and i.month = mo.month
left join costs c on c.motorcycle_id = mo.motorcycle_id and c.month = mo.month;

-- Payback per motorcycle: purchase price vs cumulative net produced.
create view public.motorcycle_payback
with (security_invoker = true) as
select m.id as motorcycle_id, m.plate, m.owner_id, m.purchase_price, m.purchase_date,
       coalesce(sum(f.income), 0)::bigint as income,
       coalesce(sum(f.costs), 0)::bigint as costs,
       coalesce(sum(f.net), 0)::bigint as net,
       case when coalesce(m.purchase_price, 0) > 0
            then round(100.0 * coalesce(sum(f.net), 0) / m.purchase_price, 1) end as recovered_pct,
       greatest(coalesce(m.purchase_price, 0) - coalesce(sum(f.net), 0), 0)::bigint as remaining
from public.motorcycles m
left join public.finance_monthly f on f.motorcycle_id = m.id
group by m.id;

grant select on public.motorcycle_costs, public.finance_monthly, public.motorcycle_payback to authenticated;
revoke all on public.motorcycle_costs, public.finance_monthly, public.motorcycle_payback from anon;
