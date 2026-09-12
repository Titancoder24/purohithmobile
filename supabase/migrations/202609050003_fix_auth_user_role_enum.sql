create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.app_role;
begin
  requested_role := case lower(coalesce(new.raw_user_meta_data ->> 'role', 'customer'))
    when 'priest' then 'priest'::public.app_role
    else 'customer'::public.app_role
  end;

  insert into public.app_users (id, role, full_name, phone, email)
  values (
    new.id,
    requested_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
  set
    full_name = coalesce(nullif(excluded.full_name, ''), public.app_users.full_name),
    phone = coalesce(nullif(excluded.phone, ''), public.app_users.phone),
    email = coalesce(nullif(excluded.email, ''), public.app_users.email),
    updated_at = now();

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
