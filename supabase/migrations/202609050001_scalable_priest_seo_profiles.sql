alter table public.priest_profiles
  add column if not exists slug text,
  add column if not exists profile_headline text not null default '',
  add column if not exists portfolio_urls text[] not null default '{}';

update public.priest_profiles
set slug = trim(both '-' from regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g'))
  || '-' || left(id::text, 8)
where slug is null or slug = '';

alter table public.priest_profiles
  drop constraint if exists priest_profiles_slug_format;
alter table public.priest_profiles
  add constraint priest_profiles_slug_format
  check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create unique index if not exists priest_profiles_slug_unique
  on public.priest_profiles (slug)
  where slug is not null;

create index if not exists priest_profiles_public_listing_idx
  on public.priest_profiles (verification_status, rating desc, updated_at desc);

create index if not exists priest_profiles_service_areas_gin
  on public.priest_profiles using gin (service_areas);

create index if not exists priest_profiles_languages_gin
  on public.priest_profiles using gin (languages);

create index if not exists priest_profiles_pooja_slugs_gin
  on public.priest_profiles using gin (pooja_slugs);

create or replace function private.assign_priest_profile_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := trim(both '-' from regexp_replace(lower(new.display_name), '[^a-z0-9]+', '-', 'g'))
      || '-' || left(new.id::text, 8);
  end if;
  return new;
end;
$$;

drop trigger if exists assign_priest_profile_slug on public.priest_profiles;
create trigger assign_priest_profile_slug
before insert or update of display_name, slug on public.priest_profiles
for each row execute function private.assign_priest_profile_slug();
