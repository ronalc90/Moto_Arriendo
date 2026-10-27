-- =============================================================================
-- Automated test: a password assigned by the administrator closes the user's
-- open sessions, and "must change password" is only cleared once the driver
-- really chose a new password. Rolls back.
-- =============================================================================
begin;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'a@example.com');
insert into public.profiles (id, full_name, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'Admin', 'admin', 'a@example.com');
-- Created from the SQL editor (privileged), like any other account
do $$ begin
  perform public.admin_create_driver_account('Hamer', 'hamer', null, '1234');
  perform public.admin_create_driver_account('Jeison', 'jeison', null, '1234');
end $$;

-- Open sessions: the admin on two devices (5a1 is the one in use), Hamer on two
-- phones plus an old refresh token without a session, Jeison on one phone.
insert into auth.sessions (id, user_id) values
  ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000005a2', '00000000-0000-4000-8000-0000000000a1');
insert into auth.sessions (id, user_id)
select s.id, p.id from public.profiles p, (values
  ('hamer', '00000000-0000-4000-8000-0000000005b1'::uuid),
  ('hamer', '00000000-0000-4000-8000-0000000005b2'::uuid),
  ('jeison', '00000000-0000-4000-8000-0000000005c1'::uuid)) s (username, id)
 where p.username = s.username;
insert into auth.refresh_tokens (token, user_id, session_id)
select 'tok-' || s.id, s.user_id::text, s.id from auth.sessions s;
insert into auth.refresh_tokens (token, user_id, session_id)
select 'tok-old', p.id::text, null from public.profiles p where p.username = 'hamer';

do $$ begin
  assert exists (select 1 from private.password_change_required c join public.profiles p on p.id = c.user_id
                  where p.username = 'hamer'), 'fingerprint kept when the account is created';
  assert not exists (select 1 from private.password_change_required
                      where user_id = '00000000-0000-4000-8000-0000000000a1'), 'nothing pending for the admin';
  assert not has_table_privilege('authenticated', 'private.password_change_required', 'select'), 'API cannot read fingerprints';
  assert not has_table_privilege('anon', 'private.password_change_required', 'select'), 'API cannot read fingerprints (anon)';
end $$;

-- Act as the admin, from session 5a1
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-0000000005a1"}', true);
do $$ begin
  perform public.admin_set_password((select id from public.profiles where username = 'hamer'), '4321');
  perform public.admin_set_password('00000000-0000-4000-8000-0000000000a1', 'ClaveLarga2026');
end $$;

reset role;
do $$
declare
  v_hamer uuid := (select id from public.profiles where username = 'hamer');
  v_jeison uuid := (select id from public.profiles where username = 'jeison');
begin
  assert not exists (select 1 from auth.sessions where user_id = v_hamer), 'driver signed out on every device';
  assert not exists (select 1 from auth.refresh_tokens where user_id = v_hamer::text), 'driver refresh tokens gone (old one too)';
  assert (select count(*) from auth.sessions where user_id = v_jeison) = 1, 'other drivers keep their session';
  assert (select count(*) from auth.refresh_tokens where user_id = v_jeison::text) = 1, 'other drivers keep their token';
  assert (select array_agg(id::text) from auth.sessions where user_id = '00000000-0000-4000-8000-0000000000a1')
         = array['00000000-0000-4000-8000-0000000005a1'], 'admin keeps only the session in use';
  assert (select array_agg(token::text) from auth.refresh_tokens where user_id = '00000000-0000-4000-8000-0000000000a1')
         = array['tok-00000000-0000-4000-8000-0000000005a1'], 'admin keeps only the token in use';
  assert (select must_change_password from public.profiles where id = v_hamer), 'driver must change the new password';
  assert (select count(*) from public.audit_log where action = 'password_reset') = 2, 'resets audited';
end $$;

-- Hamer signs in with the password the admin gave him and tries to skip the change
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where username = 'hamer'), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id::text from public.profiles where username = 'hamer'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.mark_password_changed();
    raise exception 'FAIL: flag cleared without a new password';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  assert (select must_change_password from public.profiles where id = auth.uid()), 'flag still on';
end $$;

-- The admin assigns yet another password while the change is still pending:
-- the fingerprint must follow it (otherwise the earlier one would count as "changed").
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.admin_set_password((select id from public.profiles where username = 'hamer'), '5678');
end $$;

reset role;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where username = 'hamer'), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id::text from public.profiles where username = 'hamer'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.mark_password_changed();
    raise exception 'FAIL: flag cleared with the second password from the admin';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- He chooses his own password in Supabase Auth (that changes the stored hash)
  reset role;
  update auth.users set encrypted_password = extensions.crypt('MiClave2026', extensions.gen_salt('bf')) where id = auth.uid();
  set local role authenticated;
  perform public.mark_password_changed();
  assert not (select must_change_password from public.profiles where id = auth.uid()), 'flag cleared after a real change';
  perform public.mark_password_changed(); -- nothing pending: no error ("Mi cuenta")
end $$;

reset role;
do $$ begin
  assert not exists (select 1 from private.password_change_required c join public.profiles p on p.id = c.user_id
                      where p.username = 'hamer'), 'fingerprint removed once changed';
  raise notice 'Password and session tests OK';
end $$;
rollback;
