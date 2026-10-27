-- =============================================================================
-- Security review (27/10/2026)
--  1. Administrator accounts need a password of at least 10 characters.
--     20261022001800 lowered the minimum to 4 for everyone so the admin can give
--     drivers an easy first password (drivers must replace it on their first
--     sign-in). Administrators are never asked to change theirs, so a new admin
--     (or an admin whose password another admin reset) could keep "1234" for
--     good — 10.000 guesses away from the whole business data.
--  2. complete_driver_onboarding() works only once (first sign-in). It runs as
--     SECURITY DEFINER, so a driver could call it again straight through the API
--     at any time and rewrite their cédula, license, name or emergency contact,
--     even though the drivers table is admin-only. Later changes go through the
--     administrator (Conductores → Editar).
-- =============================================================================

-- 1) Admin passwords --------------------------------------------------------------
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
  if p_role = 'admin' and length(p_password) < 10 then
    raise exception 'La contraseña de un administrador debe tener al menos 10 caracteres';
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
revoke execute on function public.admin_create_user(text, text, text, public.user_role, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, public.user_role, text) to authenticated;

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
  if length(p_password) < 10
     and exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin') then
    raise exception 'La contraseña de un administrador debe tener al menos 10 caracteres';
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
revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- 2) First sign-in data, only once -----------------------------------------------
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
  if v_profile.onboarded_at is not null then
    raise exception 'Tus datos ya están registrados. Si necesitas cambiar algo, habla con el administrador.';
  end if;
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
