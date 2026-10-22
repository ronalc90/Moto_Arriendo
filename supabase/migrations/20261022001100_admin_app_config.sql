-- Lets an admin set the e-mail delivery settings from the app (Configuración),
-- without touching the database. Values are write-only for admins: the app
-- only learns whether a key is set, never its value.
create or replace function public.admin_set_app_config(p_key text, p_value text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_key not in ('resend_api_key', 'email_from') then
    raise exception 'Clave no permitida';
  end if;
  if coalesce(trim(p_value), '') = '' then
    delete from private.app_config where key = p_key;
  else
    insert into private.app_config (key, value) values (p_key, trim(p_value))
    on conflict (key) do update set value = excluded.value;
  end if;
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'config_' || p_key, 'app_config', null, null);
end;
$$;

create or replace function public.admin_app_config_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  return jsonb_build_object(
    'email_enabled', exists (select 1 from private.app_config where key = 'resend_api_key'),
    'email_from', (select value from private.app_config where key = 'email_from'),
    'push_enabled', exists (select 1 from private.app_config where key = 'vapid_private'),
    'vapid_public', (select value from private.app_config where key = 'vapid_public'),
    'cron_enabled', exists (select 1 from private.app_config where key = 'cron')
  );
end;
$$;

-- The public VAPID key is needed by browsers to subscribe to push.
create or replace function public.vapid_public_key()
returns text
language sql stable security definer
set search_path = ''
as $$ select value from private.app_config where key = 'vapid_public' $$;

revoke execute on function public.admin_set_app_config(text, text) from public, anon;
revoke execute on function public.admin_app_config_status() from public, anon;
revoke execute on function public.vapid_public_key() from public, anon;
grant execute on function public.admin_set_app_config(text, text) to authenticated;
grant execute on function public.admin_app_config_status() to authenticated;
grant execute on function public.vapid_public_key() to authenticated;

-- Manual "send test notification" for admins (checks the whole delivery chain).
create or replace function public.admin_test_notification()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  perform public.notify(auth.uid(), 'test', 'Notificación de prueba 🔔',
    'Si ves esto, los avisos de Moto Arriendo funcionan en este dispositivo.', '/admin',
    'test:' || extract(epoch from clock_timestamp())::text);
end;
$$;
revoke execute on function public.admin_test_notification() from public, anon;
grant execute on function public.admin_test_notification() to authenticated;
