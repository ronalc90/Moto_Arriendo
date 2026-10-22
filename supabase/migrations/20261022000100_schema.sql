-- =============================================================================
-- Moto Arriendo - core schema (Phase 0 / Phase 1 tables)
-- All money values are integer COP (no decimals).
-- All "day" logic uses the America/Bogota time zone explicitly.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Time helpers (Bogota). The database itself runs in UTC.
-- ---------------------------------------------------------------------------
create or replace function public.bogota_now(p_now timestamptz default now())
returns timestamp
language sql stable
set search_path = ''
as $$ select (p_now at time zone 'America/Bogota') $$;

create or replace function public.bogota_today(p_now timestamptz default now())
returns date
language sql stable
set search_path = ''
as $$ select (p_now at time zone 'America/Bogota')::date $$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'driver');
create type public.driver_status as enum ('active', 'inactive');
create type public.motorcycle_status as enum ('active', 'in_shop', 'impounded', 'inactive');
create type public.doc_entity as enum ('motorcycle', 'driver');
create type public.doc_type as enum (
  'soat', 'insurance', 'tech_inspection', 'registration',
  'national_id', 'license', 'background_check', 'contract', 'other'
);
create type public.contract_status as enum ('active', 'ended');
create type public.loan_status as enum ('active', 'paid');
create type public.payment_method as enum ('nequi', 'daviplata', 'transfer', 'cash');
create type public.payment_status as enum ('pending', 'approved', 'rejected');
create type public.damage_status as enum ('open', 'in_repair', 'closed');

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 1),
  phone text unique check (phone is null or phone ~ '^[0-9]{10}$'),
  email text,
  role public.user_role not null default 'driver',
  active boolean not null default true,
  data_consent_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'App users (admins and drivers). id = auth.users.id';

-- ---------------------------------------------------------------------------
-- drivers
-- ---------------------------------------------------------------------------
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  national_id text not null unique,
  license_number text,
  license_category text,
  license_expires_on date,
  emergency_contact_name text,
  emergency_contact_phone text,
  referred_by text,
  deposit_amount integer not null default 0 check (deposit_amount >= 0),
  status public.driver_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- motorcycles
-- ---------------------------------------------------------------------------
create table public.motorcycles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique check (plate = upper(plate) and length(plate) between 5 and 8),
  brand text not null default 'Bajaj',
  model text not null default 'Boxer CT100',
  year integer check (year between 1990 and 2100),
  engine_cc integer check (engine_cc is null or engine_cc > 0),
  color text,
  owner_id uuid not null references public.profiles (id),
  purchase_price integer check (purchase_price is null or purchase_price >= 0),
  purchase_date date,
  gps_provider text,
  current_km integer not null default 0 check (current_km >= 0),
  status public.motorcycle_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- documents (SOAT, insurance, licenses, IDs...). Files live in the private
-- "documents" storage bucket. Two nullable FKs instead of a polymorphic id so
-- that referential integrity and RLS stay simple.
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  entity public.doc_entity not null,
  motorcycle_id uuid references public.motorcycles (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete cascade,
  doc_type public.doc_type not null,
  starts_on date,
  expires_on date,
  file_path text,
  notes text,
  uploaded_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint documents_entity_fk check (
    (entity = 'motorcycle' and motorcycle_id is not null and driver_id is null)
    or (entity = 'driver' and driver_id is not null and motorcycle_id is null)
  ),
  constraint documents_dates check (expires_on is null or starts_on is null or expires_on >= starts_on)
);
create index documents_motorcycle_idx on public.documents (motorcycle_id);
create index documents_driver_idx on public.documents (driver_id);
create index documents_expires_idx on public.documents (expires_on);

-- ---------------------------------------------------------------------------
-- contracts
-- rest_weekdays uses Postgres DOW numbering: 0 = Sunday ... 6 = Saturday
-- ---------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id),
  motorcycle_id uuid not null references public.motorcycles (id),
  daily_rate integer not null check (daily_rate between 1000 and 1000000),
  rest_weekdays smallint[] not null default '{0}'
    check (rest_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(rest_weekdays) <= 6),
  payment_deadline time not null default '21:00',
  max_late_days integer not null default 3 check (max_late_days between 1 and 30),
  start_date date not null,
  end_date date,
  file_path text,
  status public.contract_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  constraint contracts_dates check (end_date is null or end_date >= start_date)
);
create unique index contracts_one_active_per_driver on public.contracts (driver_id) where status = 'active';
create unique index contracts_one_active_per_motorcycle on public.contracts (motorcycle_id) where status = 'active';
create index contracts_motorcycle_idx on public.contracts (motorcycle_id);

-- ---------------------------------------------------------------------------
-- loans (e.g. money lent to get the motorcycle license)
-- installment_required = true -> unpaid daily installments count as debt and
-- affect the traffic light. false -> installments are voluntary.
-- ---------------------------------------------------------------------------
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id),
  concept text not null check (length(trim(concept)) > 1),
  amount integer not null check (amount > 0),
  daily_installment integer not null default 10000 check (daily_installment >= 0),
  installment_required boolean not null default true,
  loan_date date not null default public.bogota_today(),
  status public.loan_status not null default 'active',
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index loans_driver_idx on public.loans (driver_id);

-- ---------------------------------------------------------------------------
-- payments
-- total_amount = rate_amount (daily fee) + installment_amount (loan payment)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id),
  driver_id uuid not null references public.drivers (id),
  motorcycle_id uuid not null references public.motorcycles (id),
  paid_on date not null default public.bogota_today(),
  total_amount integer not null check (total_amount > 0 and total_amount <= 10000000),
  rate_amount integer not null default 0 check (rate_amount >= 0),
  installment_amount integer not null default 0 check (installment_amount >= 0),
  loan_id uuid references public.loans (id),
  method public.payment_method not null,
  receipt_path text,
  status public.payment_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint payments_split check (rate_amount + installment_amount = total_amount),
  constraint payments_loan check (installment_amount = 0 or loan_id is not null),
  constraint payments_rejection check (status <> 'rejected' or length(trim(coalesce(rejection_reason, ''))) > 0)
);
create index payments_contract_idx on public.payments (contract_id, status);
create index payments_driver_idx on public.payments (driver_id);
create index payments_loan_idx on public.payments (loan_id);
create index payments_status_idx on public.payments (status);
create index payments_paid_on_idx on public.payments (paid_on);

-- ---------------------------------------------------------------------------
-- exempt days: days the admin marks as not chargeable
-- ---------------------------------------------------------------------------
create table public.exempt_days (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  day date not null,
  reason text not null check (length(trim(reason)) > 1),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (contract_id, day)
);

-- ---------------------------------------------------------------------------
-- weekly inspections
-- checklist: {"tires":"ok|check","brakes":..,"chain":..,"lights":..,"oil":..}
-- ---------------------------------------------------------------------------
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles (id),
  driver_id uuid not null references public.drivers (id),
  contract_id uuid references public.contracts (id),
  inspected_on date not null default public.bogota_today(),
  km integer not null check (km >= 0 and km < 1000000),
  photo_front text not null,
  photo_back text not null,
  photo_left text not null,
  photo_right text not null,
  photo_dashboard text not null,
  checklist jsonb not null,
  notes text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  constraint inspections_checklist check (
    jsonb_typeof(checklist) = 'object'
    and checklist ?& array['tires', 'brakes', 'chain', 'lights', 'oil']
  )
);
create index inspections_motorcycle_idx on public.inspections (motorcycle_id, inspected_on desc);
create index inspections_driver_idx on public.inspections (driver_id, inspected_on desc);

-- ---------------------------------------------------------------------------
-- damage reports
-- ---------------------------------------------------------------------------
create table public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles (id),
  driver_id uuid not null references public.drivers (id),
  reported_on date not null default public.bogota_today(),
  description text not null check (length(trim(description)) > 3),
  photos text[] not null default '{}',
  status public.damage_status not null default 'open',
  resolution_notes text,
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index damage_reports_status_idx on public.damage_reports (status);

-- ---------------------------------------------------------------------------
-- settings (single row)
-- ---------------------------------------------------------------------------
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null default 'Moto Arriendo',
  inspection_weekday smallint not null default 1 check (inspection_weekday between 0 and 6),
  doc_alert_days integer[] not null default '{30,15,7}',
  default_daily_rate integer not null default 40000 check (default_daily_rate > 0),
  default_daily_installment integer not null default 10000 check (default_daily_installment >= 0),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------------
-- audit log (who did what and when). Written only by triggers.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_record_idx on public.audit_log (table_name, record_id);
create index audit_log_created_idx on public.audit_log (created_at desc);
