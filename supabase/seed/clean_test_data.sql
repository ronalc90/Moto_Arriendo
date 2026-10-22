-- Removes ONLY the test data created by seed_test_data.sql
-- (plates PRU01A / PRU02A and drivers 3000000001 / 3000000002).
delete from public.notifications n
 where exists (select 1 from public.motorcycles m
                where m.plate in ('PRU01A', 'PRU02A', 'PRU03A') and n.url like '%' || m.id::text || '%');
delete from public.payments where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A', 'PRU03A'));
delete from public.inspections where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A', 'PRU03A'));
delete from public.damage_reports where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A', 'PRU03A'));
delete from public.incidents where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A', 'PRU03A'));
delete from public.loans where driver_id in (
  select d.id from public.drivers d join public.profiles p on p.id = d.profile_id where p.phone in ('3000000001', '3000000002', '3000000003'));
delete from public.contracts where motorcycle_id in (select id from public.motorcycles where plate in ('PRU01A', 'PRU02A', 'PRU03A'));
delete from public.motorcycles where plate in ('PRU01A', 'PRU02A', 'PRU03A');
delete from auth.users where email in ('3000000001@conductores.moto-arriendo.app', '3000000002@conductores.moto-arriendo.app', '3000000003@conductores.moto-arriendo.app');
