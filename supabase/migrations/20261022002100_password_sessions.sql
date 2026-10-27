-- =============================================================================
-- Sessions and password changes (27/10/2026) — follow-up to the security review
--  1. admin_set_password() now closes the user's open sessions. Before, whoever
--     was signed in with the old password (a lost phone, someone who learned
--     it) kept using the app after the administrator assigned a new one.
--  2. mark_password_changed() only clears "must change password" when the
--     password really changed after the change was required. Before, a driver
--     could call it straight through the API and keep the password the
--     administrator gave them (it can be 4 characters long).
--     auth.users.updated_at is not a reliable signal: Supabase Auth also bumps
--     it on other writes (for example, every sign-in). So, when the change is
--     required, we keep a fingerprint (SHA-256 of the stored hash, never the
--     hash itself) in private.password_change_required, which the API cannot
--     reach.
-- =============================================================================

-- 2) Fingerprint of the password in place when the change was required ----------
create table if not exists private.password_change_required (
  user_id uuid primary key references auth.users (id) on delete cascade,
  password_fingerprint bytea not null,
  required_at timestamptz not null default now()
);
revoke all on private.password_change_required from public, anon, authenticated;

-- Every path that sets must_change_password (admin_set_password,
-- admin_create_driver_account, an administrator editing the row) goes through
-- this trigger. It refreshes the fingerprint even when the flag was already on,
-- because a new password may have been assigned in the meantime.
create or replace function public.profiles_password_change_required()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.must_change_password then
    insert into private.password_change_required (user_id, password_fingerprint)
    select u.id, extensions.digest(coalesce(u.encrypted_password, ''), 'sha256')
      from auth.users u
     where u.id = new.id
    on conflict (user_id) do update
      set password_fingerprint = excluded.password_fingerprint, required_at = now();
  else
    delete from private.password_change_required where user_id = new.id;
  end if;
  return null;
end;
$$;
revoke execute on function public.profiles_password_change_required() from public, anon, authenticated;

create or replace trigger profiles_password_change_required
  after insert or update of must_change_password on public.profiles
  for each row execute function public.profiles_password_change_required();

-- Drivers who still have to change it today.
insert into private.password_change_required (user_id, password_fingerprint)
select p.id, extensions.digest(coalesce(u.encrypted_password, ''), 'sha256')
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.must_change_password
on conflict (user_id) do nothing;

-- Called by the app right after the driver sets their own password in Supabase
-- Auth. It no longer trusts the call: the stored hash must be a different one.
create or replace function public.mark_password_changed()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_required bytea;
  v_current bytea;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and must_change_password) then
    return; -- nothing pending (e.g. a voluntary change from "Mi cuenta")
  end if;
  select c.password_fingerprint into v_required
    from private.password_change_required c
   where c.user_id = auth.uid();
  select extensions.digest(coalesce(u.encrypted_password, ''), 'sha256') into v_current
    from auth.users u
   where u.id = auth.uid();
  if v_required is null or v_current is not distinct from v_required then
    raise exception 'Primero cambia la contraseña que te dio el administrador';
  end if;
  update public.profiles set must_change_password = false where id = auth.uid();
end;
$$;
revoke execute on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;

-- 1) A new password closes the open sessions ------------------------------------
create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_my_session text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id';
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
  -- Sign the user out on every device, like Supabase Auth does when someone
  -- changes their own password (an administrator resetting their own password
  -- keeps the session they are using). Refresh tokens are deleted with their
  -- session (on delete cascade); the second delete catches any token without one.
  -- The access token already issued stays valid until it expires (1 hour by
  -- default), but it can no longer be renewed.
  delete from auth.sessions s
   where s.user_id = p_user_id
     and (p_user_id is distinct from auth.uid() or s.id::text is distinct from v_my_session);
  delete from auth.refresh_tokens t
   where t.user_id = p_user_id::text
     and t.session_id is null;
  -- A driver must replace a password chosen by someone else.
  update public.profiles set must_change_password = true where id = p_user_id and role = 'driver';
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'password_reset', 'profiles', p_user_id, null);
end;
$$;
revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
