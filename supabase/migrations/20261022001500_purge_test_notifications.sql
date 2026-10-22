-- =============================================================================
-- admin_purge_test_data(): also remove the ADMIN notifications that point to
-- the deleted test records (payments, damage reports, ...) or mention a test
-- plate / test driver by name. Before, they stayed in the bell as dead links.
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
  v_children uuid[];
  v_labels text[];
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

  -- Ids that notification links can point to.
  select coalesce(array_agg(id), '{}') into v_children from (
    select id from public.payments where contract_id = any (v_contracts) or driver_id = any (v_drivers)
    union all select id from public.damage_reports where motorcycle_id = any (v_motos) or driver_id = any (v_drivers)
    union all select id from public.inspections where motorcycle_id = any (v_motos) or driver_id = any (v_drivers)
    union all select id from public.incidents where motorcycle_id = any (v_motos) or driver_id = any (v_drivers)
    union all select id from public.loans where driver_id = any (v_drivers)
    union all select id from public.documents where motorcycle_id = any (v_motos) or driver_id = any (v_drivers)
  ) x;
  -- Plates and names that notification texts can mention.
  select coalesce(array_agg(l), '{}') into v_labels from (
    select plate as l from public.motorcycles where id = any (v_motos)
    union all select full_name from public.profiles where id = any (v_users)
  ) y;

  delete from public.notifications n
   where n.profile_id = any (v_users)
      or exists (select 1 from unnest(v_motos || v_drivers || v_contracts || v_children) x(id)
                  where n.url like '%' || x.id::text || '%')
      or exists (select 1 from unnest(v_labels) l(t)
                  where n.title like '%' || l.t || '%' or n.body like '%' || l.t || '%');
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
   where record_id = any (v_motos || v_drivers || v_users || v_contracts || v_children);

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
