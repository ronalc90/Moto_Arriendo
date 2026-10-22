-- =============================================================================
-- Account management done inside the database, callable only by admins.
-- This avoids shipping the Supabase secret (service_role) key to the web app:
-- the app never needs it. Public sign-up stays useless because a user without
-- a profile row has no access to anything (and sign-ups should be disabled in
-- the Supabase dashboard, see docs/instalacion.md).
--
-- Drivers sign in with "phone + password". Internally their login e-mail is
-- <phone>@conductores.moto-arriendo.app (never used to send mail).
-- =============================================================================

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
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
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

create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_privileged_role()) then
    raise exception 'No autorizado';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'password_reset', 'profiles', p_user_id, null);
end;
$$;

revoke execute on function public.admin_create_user(text, text, text, public.user_role, text) from public, anon;
revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, public.user_role, text) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
