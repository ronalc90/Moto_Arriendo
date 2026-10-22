-- =============================================================================
-- Moto Arriendo - Row Level Security
-- Admins: full access. Drivers: only their own rows (read) and only the inserts
-- they need (payments, inspections, damage reports, personal documents).
-- Anonymous users: nothing.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.motorcycles enable row level security;
alter table public.documents enable row level security;
alter table public.contracts enable row level security;
alter table public.loans enable row level security;
alter table public.payments enable row level security;
alter table public.exempt_days enable row level security;
alter table public.inspections enable row level security;
alter table public.damage_reports enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

-- Defense in depth: the anon role gets no table access at all.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- profiles --------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check ((select public.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_admin_delete on public.profiles for delete to authenticated
  using ((select public.is_admin()));

-- drivers ---------------------------------------------------------------------
create policy drivers_select on public.drivers for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy drivers_admin_write on public.drivers for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- motorcycles: drivers only see the motorcycle of their active contract ---------
create policy motorcycles_select on public.motorcycles for select to authenticated
  using ((select public.is_admin()) or id = (select public.my_motorcycle_id()));
create policy motorcycles_admin_write on public.motorcycles for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- documents -------------------------------------------------------------------
create policy documents_select on public.documents for select to authenticated
  using (
    (select public.is_admin())
    or (entity = 'driver' and driver_id = (select public.my_driver_id()))
    or (entity = 'motorcycle' and motorcycle_id = (select public.my_motorcycle_id()))
  );
create policy documents_insert on public.documents for insert to authenticated
  with check (
    (select public.is_admin())
    or (entity = 'driver' and driver_id = (select public.my_driver_id())
        and doc_type in ('national_id', 'license', 'background_check', 'other'))
  );
create policy documents_admin_update on public.documents for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy documents_admin_delete on public.documents for delete to authenticated
  using ((select public.is_admin()));

-- contracts -------------------------------------------------------------------
create policy contracts_select on public.contracts for select to authenticated
  using ((select public.is_admin()) or driver_id = (select public.my_driver_id()));
create policy contracts_admin_write on public.contracts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- loans -----------------------------------------------------------------------
create policy loans_select on public.loans for select to authenticated
  using ((select public.is_admin()) or driver_id = (select public.my_driver_id()));
create policy loans_admin_write on public.loans for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- payments --------------------------------------------------------------------
create policy payments_select on public.payments for select to authenticated
  using ((select public.is_admin()) or driver_id = (select public.my_driver_id()));
create policy payments_insert on public.payments for insert to authenticated
  with check (
    (select public.is_admin())
    or (driver_id = (select public.my_driver_id()) and status = 'pending')
  );
create policy payments_admin_update on public.payments for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy payments_admin_delete on public.payments for delete to authenticated
  using ((select public.is_admin()));

-- exempt days -----------------------------------------------------------------
create policy exempt_days_select on public.exempt_days for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.contracts c
                where c.id = contract_id and c.driver_id = (select public.my_driver_id()))
  );
create policy exempt_days_admin_write on public.exempt_days for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- inspections -----------------------------------------------------------------
create policy inspections_select on public.inspections for select to authenticated
  using ((select public.is_admin()) or driver_id = (select public.my_driver_id()));
create policy inspections_insert on public.inspections for insert to authenticated
  with check (
    (select public.is_admin())
    or (driver_id = (select public.my_driver_id()) and motorcycle_id = (select public.my_motorcycle_id()))
  );
create policy inspections_admin_update on public.inspections for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy inspections_admin_delete on public.inspections for delete to authenticated
  using ((select public.is_admin()));

-- damage reports --------------------------------------------------------------
create policy damage_reports_select on public.damage_reports for select to authenticated
  using ((select public.is_admin()) or driver_id = (select public.my_driver_id()));
create policy damage_reports_insert on public.damage_reports for insert to authenticated
  with check (
    (select public.is_admin())
    or (driver_id = (select public.my_driver_id()) and motorcycle_id = (select public.my_motorcycle_id()))
  );
create policy damage_reports_admin_update on public.damage_reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy damage_reports_admin_delete on public.damage_reports for delete to authenticated
  using ((select public.is_admin()));

-- settings: everyone signed in can read, only admins change -------------------
create policy settings_select on public.settings for select to authenticated using (true);
create policy settings_admin_update on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- audit log: admins read; nobody writes directly (triggers only) ---------------
create policy audit_log_admin_select on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- Views are security_invoker; expose them only to signed-in users.
revoke all on public.loan_balances, public.contract_overview, public.document_expirations,
  public.inspection_status from anon;
grant select on public.loan_balances, public.contract_overview, public.document_expirations,
  public.inspection_status to authenticated;

-- Functions: nothing for anon.
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.bogota_now(timestamptz),
  public.bogota_today(timestamptz),
  public.is_admin(),
  public.my_driver_id(),
  public.my_motorcycle_id(),
  public.is_privileged_role(),
  public.accept_data_policy(),
  public.count_chargeable_days(uuid, date, date),
  public.contract_summary(uuid, timestamptz),
  public.contract_calendar(uuid, date, date, timestamptz),
  public.allocate_payment(uuid, integer, uuid, timestamptz)
to authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;
