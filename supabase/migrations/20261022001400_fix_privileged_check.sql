-- =============================================================================
-- SECURITY FIX. is_privileged_role() used current_user, but inside a SECURITY
-- DEFINER function current_user is the function OWNER (postgres), so every
-- admin_* function treated any signed-in user as privileged.
--
-- Now it looks at who is really calling:
--   * the API with the secret key        -> JWT role 'service_role'
--   * SQL editor / migrations / pg_cron  -> session_user postgres|supabase_admin
--                                           with no end-user JWT
-- Requests from the app (anon/authenticated JWT, session_user 'authenticator')
-- are never privileged, no matter which function they go through.
-- =============================================================================
create or replace function public.is_privileged_role()
returns boolean
language sql stable
set search_path = ''
as $$
  with c as (
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') as jwt_role
  )
  select c.jwt_role = 'service_role'
      or (session_user in ('postgres', 'supabase_admin') and c.jwt_role not in ('authenticated', 'anon'))
  from c
$$;
