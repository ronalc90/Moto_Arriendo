-- =============================================================================
-- Test data (seed) — run in Supabase SQL Editor. Safe to re-run: it deletes the
-- previous test data first (only rows created by this script).
--
-- Creates:
--   * Drivers "Hamer (prueba)" 3000000001 and "Jeison (prueba)" 3000000002
--     password: Prueba2026!
--   * Motorcycles PRU01A and PRU02A (Bajaj Boxer CT100), owner = first admin
--   * Contracts starting 3 weeks ago, $40.000/day, rest day Sunday
--   * Loan "Pase A2" $1.200.000 with $10.000 daily installment for Hamer
--   * Payment history: Hamer up to date (+1 pending today), Jeison 2 days late
--     (+1 rejected payment)
--   * SOAT of PRU01A expiring in 15 days, Hamer's license in 25 days,
--     PRU01A close to its oil change (2.800 km, first service at 950 km)
-- Remove everything with supabase/seed/clean_test_data.sql
-- =============================================================================
do $$
declare
  v_owner uuid;
  v_hamer uuid;
  v_jeison uuid;
  v_m1 uuid;
  v_m2 uuid;
  v_c1 uuid;
  v_c2 uuid;
  v_loan uuid;
  v_today date := public.bogota_today();
  v_start date;
  v_last_due date;
  d record;
begin
  -- 0) Clean previous test data
  delete from public.payments where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A'));
  delete from public.inspections where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A'));
  delete from public.damage_reports where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A'));
  delete from public.incidents where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A'));
  delete from public.loans where driver_id in (select d2.id from public.drivers d2 join public.profiles p on p.id = d2.profile_id where p.phone in ('3000000001', '3000000002'));
  delete from public.contracts where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A'));
  delete from public.motorcycles where plate in ('PRU01A', 'PRU02A');
  delete from auth.users where email in ('3000000001@conductores.moto-arriendo.app', '3000000002@conductores.moto-arriendo.app');

  select id into v_owner from public.profiles where role = 'admin' and active order by created_at limit 1;
  if v_owner is null then
    raise exception 'Primero crea un administrador';
  end if;

  -- Contracts start on the Monday three weeks ago
  v_start := (v_today - ((extract(dow from v_today)::int + 6) % 7)) - 21;
  v_last_due := case when (now() at time zone 'America/Bogota')::time >= time '21:00' then v_today else v_today - 1 end;

  -- 1) Drivers
  v_hamer := public.admin_create_driver('Hamer (prueba)', '3000000001', 'Prueba2026!', '1000000001',
    'L-0001', 'A2', v_today + 25, 'María (mamá)', '3001112233', 'Ronald', 300000, 'Conductor de prueba');
  v_jeison := public.admin_create_driver('Jeison (prueba)', '3000000002', 'Prueba2026!', '1000000002',
    'L-0002', 'A2', v_today + 300, 'Carlos (hermano)', '3004445566', 'Ronald', 300000, 'Conductor de prueba');
  update public.profiles set data_consent_at = now() - interval '20 days'
   where id = (select profile_id from public.drivers where id = v_hamer);

  -- 2) Motorcycles
  insert into public.motorcycles (plate, brand, model, year, engine_cc, color, owner_id, purchase_price, purchase_date, gps_provider, current_km)
  values ('PRU01A', 'Bajaj', 'Boxer CT100', 2026, 100, 'Negro/rojo', v_owner, 6290000, v_start - 7, 'GPS Colombia', 2800)
  returning id into v_m1;
  insert into public.motorcycles (plate, brand, model, year, engine_cc, color, owner_id, purchase_price, purchase_date, gps_provider, current_km)
  values ('PRU02A', 'Bajaj', 'Boxer CT100', 2026, 100, 'Negro/azul', v_owner, 6290000, v_start - 7, 'GPS Colombia', 1450)
  returning id into v_m2;

  -- 3) Contracts ($40.000, rest on Sunday)
  insert into public.contracts (driver_id, motorcycle_id, daily_rate, rest_weekdays, start_date, notes)
  values (v_hamer, v_m1, 40000, '{0}', v_start, 'Contrato de prueba') returning id into v_c1;
  insert into public.contracts (driver_id, motorcycle_id, daily_rate, rest_weekdays, start_date, notes)
  values (v_jeison, v_m2, 40000, '{0}', v_start, 'Contrato de prueba') returning id into v_c2;

  -- 4) Loan for Hamer
  insert into public.loans (driver_id, concept, amount, daily_installment, installment_required, loan_date, notes)
  values (v_hamer, 'Pase A2', 1200000, 10000, true, v_start, 'Préstamo de prueba') returning id into v_loan;

  -- 5) Payments
  -- Hamer: every chargeable day paid ($40.000 + $10.000 abono)
  for d in
    select g::date as day from generate_series(v_start::timestamp, v_last_due::timestamp, interval '1 day') g
     where extract(dow from g) <> 0
  loop
    insert into public.payments (contract_id, driver_id, motorcycle_id, paid_on, total_amount, rate_amount, installment_amount,
                                 loan_id, method, status, created_at, reviewed_at, reviewed_by)
    values (v_c1, v_hamer, v_m1, d.day, 50000, 40000, 10000, v_loan, 'nequi', 'approved',
            (d.day + time '18:30') at time zone 'America/Bogota', (d.day + time '20:00') at time zone 'America/Bogota', v_owner);
  end loop;
  -- Hamer: today's payment waiting for review (with a sample receipt)
  insert into public.payments (contract_id, driver_id, motorcycle_id, paid_on, total_amount, rate_amount, installment_amount,
                               loan_id, method, receipt_path, status)
  values (v_c1, v_hamer, v_m1, v_today, 50000, 40000, 10000, v_loan, 'nequi', v_hamer || '/muestra-comprobante.jpg', 'pending');

  -- Jeison: all chargeable days paid except the last two
  for d in
    select day from (
      select g::date as day, row_number() over (order by g desc) as rn
        from generate_series(v_start::timestamp, v_last_due::timestamp, interval '1 day') g
       where extract(dow from g) <> 0
    ) x where rn > 2
  loop
    insert into public.payments (contract_id, driver_id, motorcycle_id, paid_on, total_amount, rate_amount, installment_amount,
                                 method, status, created_at, reviewed_at, reviewed_by)
    values (v_c2, v_jeison, v_m2, d.day, 40000, 40000, 0, 'daviplata', 'approved',
            (d.day + time '19:10') at time zone 'America/Bogota', (d.day + time '20:30') at time zone 'America/Bogota', v_owner);
  end loop;
  -- Jeison: a rejected payment (unreadable receipt)
  insert into public.payments (contract_id, driver_id, motorcycle_id, paid_on, total_amount, rate_amount, installment_amount,
                               method, receipt_path, status, rejection_reason, reviewed_by, reviewed_at)
  values (v_c2, v_jeison, v_m2, v_last_due, 40000, 40000, 0, 'daviplata', v_jeison || '/muestra-comprobante.jpg', 'rejected',
          'El comprobante no se lee. Vuelve a subirlo.', v_owner, now());

  -- 6) Documents and maintenance
  insert into public.documents (entity, motorcycle_id, doc_type, starts_on, expires_on, notes, uploaded_by) values
    ('motorcycle', v_m1, 'soat', v_today - 350, v_today + 15, 'SOAT de prueba', v_owner),
    ('motorcycle', v_m2, 'soat', v_today - 300, v_today + 65, 'SOAT de prueba', v_owner),
    ('motorcycle', v_m1, 'insurance', v_start - 7, v_start + 358, 'Todo riesgo de prueba', v_owner),
    ('motorcycle', v_m2, 'insurance', v_start - 7, v_start + 358, 'Todo riesgo de prueba', v_owner);
  insert into public.maintenance_records (motorcycle_id, service_type, performed_on, km, description, workshop, cost, paid_by)
  values (v_m1, 'first_service', v_start + 9, 950, 'Primera revisión de garantía', 'Concesionario Bajaj', 0, 'owner');
  insert into public.expenses (motorcycle_id, category, spent_on, amount, description) values
    (v_m1, 'gps', v_start - 5, 180000, 'Instalación GPS'),
    (v_m2, 'gps', v_start - 5, 180000, 'Instalación GPS');

  -- 7) Inspection: Hamer did this week's, Jeison is pending
  insert into public.inspections (motorcycle_id, driver_id, contract_id, inspected_on, km,
    photo_front, photo_back, photo_left, photo_right, photo_dashboard, checklist, notes)
  values (v_m1, v_hamer, v_c1, v_today - ((extract(dow from v_today)::int + 6) % 7), 2800,
    v_hamer || '/muestra-frente.jpg', v_hamer || '/muestra-atras.jpg', v_hamer || '/muestra-izquierda.jpg',
    v_hamer || '/muestra-derecha.jpg', v_hamer || '/muestra-tablero.jpg',
    '{"tires":"ok","brakes":"ok","chain":"check","lights":"ok","oil":"ok"}', 'La cadena suena un poco');

  raise notice 'Datos de prueba creados. Hamer: %, Jeison: %', v_hamer, v_jeison;
end;
$$;

-- Check: Hamer al día, Jeison 2 días de atraso
select driver_name, plate, light, late_days, total_debt, pending_count
from public.contract_overview
where plate in ('PRU01A', 'PRU02A')
order by plate;
