-- Creates the login account, profile and driver row in a single transaction.
create or replace function public.admin_create_driver(
  p_full_name text,
  p_phone text,
  p_password text,
  p_national_id text,
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
  v_user uuid;
  v_driver uuid;
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;
  if p_phone !~ '^[0-9]{10}$' then
    raise exception 'El celular debe tener 10 dígitos';
  end if;
  if length(trim(coalesce(p_national_id, ''))) < 4 then
    raise exception 'La cédula no es válida';
  end if;
  if exists (select 1 from public.drivers d where d.national_id = trim(p_national_id)) then
    raise exception 'Ya existe un conductor con esa cédula';
  end if;

  v_user := public.admin_create_user(
    p_phone || '@conductores.moto-arriendo.app', p_password, p_full_name, 'driver', p_phone);

  insert into public.drivers (
    profile_id, national_id, license_number, license_category, license_expires_on,
    emergency_contact_name, emergency_contact_phone, referred_by, deposit_amount, notes
  ) values (
    v_user, trim(p_national_id), nullif(trim(p_license_number), ''), nullif(trim(p_license_category), ''),
    p_license_expires_on, nullif(trim(p_emergency_contact_name), ''), nullif(trim(p_emergency_contact_phone), ''),
    nullif(trim(p_referred_by), ''), coalesce(p_deposit_amount, 0), nullif(trim(p_notes), '')
  )
  returning id into v_driver;

  return v_driver;
end;
$$;

revoke execute on function public.admin_create_driver(text, text, text, text, text, text, date, text, text, text, integer, text) from public, anon;
grant execute on function public.admin_create_driver(text, text, text, text, text, text, date, text, text, text, integer, text) to authenticated;

-- Deactivating a driver also blocks their login (profiles.active = false).
create or replace function public.admin_set_driver_active(p_driver_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;
  update public.drivers set status = case when p_active then 'active'::public.driver_status else 'inactive'::public.driver_status end
   where id = p_driver_id;
  update public.profiles p set active = p_active
    from public.drivers d where d.id = p_driver_id and p.id = d.profile_id;
end;
$$;
revoke execute on function public.admin_set_driver_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_driver_active(uuid, boolean) to authenticated;
