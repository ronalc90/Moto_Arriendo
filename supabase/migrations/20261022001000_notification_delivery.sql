-- =============================================================================
-- Notification delivery (web push + e-mail) through the Supabase Edge Function
-- "notify". The service_role key never leaves Supabase: the Edge Function gets
-- it automatically. Runtime settings (VAPID keys, cron key, function URL, Resend
-- key) live in private.app_config, which is NOT exposed through the API.
--
-- Values are inserted outside of version control, e.g.:
--   insert into private.app_config (key, value) values
--     ('cron', '<random 48+ chars>'),
--     ('functions_url', 'https://<ref>.supabase.co/functions/v1'),
--     ('vapid_public', '...'), ('vapid_private', '...'), ('vapid_subject', 'mailto:you@example.com'),
--     ('resend_api_key', 're_...'), ('email_from', 'Moto Arriendo <onboarding@resend.dev>'),
--     ('app_url', 'https://moto-arriendo.vercel.app');
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_config (
  key text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

-- Only the service role (used by the Edge Function) can read the config.
create or replace function public.get_app_config(p_key text)
returns text
language sql stable security definer
set search_path = ''
as $$ select value from private.app_config where key = p_key $$;
revoke execute on function public.get_app_config(text) from public, anon, authenticated;
grant execute on function public.get_app_config(text) to service_role;

-- Generating scheduled notifications is also reserved to the service role.
grant execute on function public.generate_notifications(timestamptz) to service_role;

-- Calls the Edge Function asynchronously (pg_net). No-op if not configured.
create or replace function public.dispatch_notifications(p_generate boolean default false)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text := (select value from private.app_config where key = 'functions_url');
  v_key text := (select value from private.app_config where key = 'cron');
begin
  if v_url is null or v_key is null or to_regnamespace('net') is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 20000)'
    using v_url || '/notify',
          jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', v_key),
          jsonb_build_object('generate', p_generate);
end;
$$;
revoke execute on function public.dispatch_notifications(boolean) from public, anon, authenticated;

-- Push new notifications right away (one call per insert statement).
create or replace function public.notifications_after_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.dispatch_notifications(false);
  return null;
end;
$$;
revoke execute on function public.notifications_after_insert() from public, anon, authenticated;
create trigger notifications_after_insert after insert on public.notifications
  for each statement execute function public.notifications_after_insert();

-- Every 15 minutes: generate scheduled notifications and retry pending deliveries.
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'moto-arriendo-notify';
    perform cron.schedule('moto-arriendo-notify', '*/15 * * * *', 'select public.dispatch_notifications(true)');
  end if;
end;
$$;
