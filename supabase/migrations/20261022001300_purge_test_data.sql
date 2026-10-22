-- =============================================================================
-- Removes the TEST data created by supabase/seed/seed_test_data.sql and by the
-- automated tests (plates PRU01A/PRU02A/PRU03A, phones 3000000001-3000000003).
-- Real data is never touched. Callable only by admins (button in Configuración).
-- Returns the storage folders the app must empty afterwards.
-- =============================================================================
create or replace function public.admin_purge_test_data()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_motos uuid[];
  v_drivers uuid[];
  v_users uuid[];
  v_contracts uuid[];
  v_payments integer;
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(array_agg(id), '{}') into v_motos
    from public.motorcycles where plate in ('PRU01A', 'PRU02A', 'PRU03A');
  select coalesce(array_agg(p.id), '{}') into v_users
    from public.profiles p where p.phone in ('3000000001', '3000000002', '3000000003') and p.role = 'driver';
  select coalesce(array_agg(d.id), '{}') into v_drivers
    from public.drivers d where d.profile_id = any (v_users);
  select coalesce(array_agg(c.id), '{}') into v_contracts
    from public.contracts c where c.motorcycle_id = any (v_motos) or c.driver_id = any (v_drivers);

  if exists (select 1 from public.contracts c
              where c.id = any (v_contracts)
                and not (c.motorcycle_id = any (v_motos) and c.driver_id = any (v_drivers))) then
    raise exception 'Hay contratos que mezclan datos de prueba con datos reales. Revísalos antes de borrar.';
  end if;

  delete from public.notifications n
   where n.profile_id = any (v_users)
      or exists (select 1 from unnest(v_motos || v_drivers || v_contracts) x(id) where n.url like '%' || x.id::text || '%');
  delete from public.payments where contract_id = any (v_contracts) or driver_id = any (v_drivers);
  get diagnostics v_payments = row_count;
  delete from public.inspections where motorcycle_id = any (v_motos) or driver_id = any (v_drivers);
  delete from public.damage_reports where motorcycle_id = any (v_motos) or driver_id = any (v_drivers);
  delete from public.incidents where motorcycle_id = any (v_motos) or driver_id = any (v_drivers);
  delete from public.loans where driver_id = any (v_drivers);
  delete from public.exempt_days where contract_id = any (v_contracts);
  delete from public.contracts where id = any (v_contracts);
  delete from public.documents where motorcycle_id = any (v_motos) or driver_id = any (v_drivers);
  delete from public.maintenance_records where motorcycle_id = any (v_motos);
  delete from public.expenses where motorcycle_id = any (v_motos);
  delete from public.motorcycles where id = any (v_motos);
  delete from public.drivers where id = any (v_drivers);
  delete from auth.users where id = any (v_users);
  delete from public.audit_log
   where record_id = any (v_motos || v_drivers || v_users || v_contracts);

  return jsonb_build_object(
    'motorcycles', cardinality(v_motos),
    'drivers', cardinality(v_drivers),
    'payments', v_payments,
    'driver_folders', to_jsonb(v_drivers),
    'moto_folders', to_jsonb(v_motos)
  );
end;
$$;
revoke execute on function public.admin_purge_test_data() from public, anon;
grant execute on function public.admin_purge_test_data() to authenticated;

-- Small helper so the app can show the button only while test data exists.
create or replace function public.has_test_data()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.motorcycles where plate in ('PRU01A', 'PRU02A', 'PRU03A')
    union all
    select 1 from public.profiles where phone in ('3000000001', '3000000002', '3000000003')
  )
$$;
revoke execute on function public.has_test_data() from public, anon;
grant execute on function public.has_test_data() to authenticated;
