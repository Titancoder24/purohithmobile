create table if not exists public.priest_services (
  id uuid primary key default gen_random_uuid(),
  priest_id uuid not null references public.priest_profiles(id) on delete cascade,
  pooja_slug text not null references public.poojas(slug) on update cascade on delete restrict,
  price_paise bigint not null check (price_paise >= 100),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  includes_samagri boolean not null default false,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (priest_id, pooja_slug)
);

insert into public.priest_services (priest_id, pooja_slug, price_paise, duration_minutes)
select pp.id, service_slug.pooja_slug, greatest(coalesce(pp.starting_price_inr, p.base_price_inr, 100), 1)::bigint * 100, p.duration_minutes
from public.priest_profiles pp
cross join lateral unnest(coalesce(pp.pooja_slugs, array[]::text[])) as service_slug(pooja_slug)
join public.poojas p on p.slug = service_slug.pooja_slug
on conflict (priest_id, pooja_slug) do nothing;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  request_id uuid references public.ceremony_requests(id) on delete set null,
  proposal_id uuid references public.ceremony_proposals(id) on delete set null,
  customer_id uuid not null references public.app_users(id) on delete restrict,
  priest_id uuid references public.priest_profiles(id) on delete restrict,
  pooja_slug text references public.poojas(slug) on update cascade on delete restrict,
  provider text not null default 'cashfree' check (provider = 'cashfree'),
  environment text not null check (environment in ('sandbox', 'production')),
  merchant_order_id text not null unique,
  provider_order_id text,
  payment_session_id text,
  amount_paise bigint not null check (amount_paise >= 100),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','active','paid','failed','expired','cancelled','refunded','partially_refunded','disputed')),
  provider_status text,
  idempotency_key uuid not null default gen_random_uuid() unique,
  return_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (booking_id is not null or request_id is not null)
);

create unique index if not exists payment_orders_one_open_booking_idx
  on public.payment_orders (booking_id)
  where booking_id is not null and status in ('created','active','paid');
create unique index if not exists payment_orders_one_open_request_idx
  on public.payment_orders (request_id)
  where request_id is not null and status in ('created','active','paid');
create index if not exists payment_orders_customer_created_idx on public.payment_orders (customer_id, created_at desc);
create index if not exists payment_orders_priest_status_idx on public.payment_orders (priest_id, status, created_at desc);
create index if not exists payment_orders_status_created_idx on public.payment_orders (status, created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  provider_event_id text,
  event_type text not null,
  signature_valid boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  raw_body_hash text not null,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  unique (raw_body_hash)
);
create index if not exists payment_events_order_received_idx on public.payment_events (payment_order_id, received_at desc);
create index if not exists payment_events_provider_event_idx on public.payment_events (provider_event_id) where provider_event_id is not null;

create table if not exists public.provider_earnings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  payment_order_id uuid not null unique references public.payment_orders(id) on delete restrict,
  priest_id uuid not null references public.priest_profiles(id) on delete restrict,
  gross_paise bigint not null check (gross_paise > 0),
  platform_fee_paise bigint not null default 0 check (platform_fee_paise >= 0),
  tax_paise bigint not null default 0 check (tax_paise >= 0),
  net_paise bigint generated always as (gross_paise - platform_fee_paise - tax_paise) stored,
  status text not null default 'held' check (status in ('held','available','release_pending','released','reversed','disputed')),
  available_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gross_paise >= platform_fee_paise + tax_paise)
);
create index if not exists provider_earnings_priest_status_idx on public.provider_earnings (priest_id, status, created_at desc);

create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  priest_id uuid not null unique references public.priest_profiles(id) on delete cascade,
  provider text not null default 'cashfree' check (provider = 'cashfree'),
  beneficiary_id text unique,
  method text check (method in ('bank','upi')),
  masked_destination text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','disabled')),
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  earning_id uuid not null unique references public.provider_earnings(id) on delete restrict,
  priest_id uuid not null references public.priest_profiles(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  provider text not null default 'cashfree' check (provider = 'cashfree'),
  provider_transfer_id text unique,
  provider_reference text,
  utr text,
  status text not null default 'queued' check (status in ('queued','processing','success','failed','reversed','cancelled')),
  requested_by uuid not null references public.app_users(id) on delete restrict,
  approved_by uuid references public.app_users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payouts_priest_status_idx on public.payouts (priest_id, status, created_at desc);

alter table public.priest_services enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.provider_earnings enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.payouts enable row level security;

create policy "Public reads active priest services" on public.priest_services
  for select using (is_active = true);
create policy "Priests manage own services" on public.priest_services
  for all to authenticated
  using (exists (select 1 from public.priest_profiles pp where pp.id = priest_id and pp.user_id = auth.uid()))
  with check (exists (select 1 from public.priest_profiles pp where pp.id = priest_id and pp.user_id = auth.uid()));
create policy "Admins manage priest services" on public.priest_services
  for all to authenticated
  using (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active))
  with check (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active));

create policy "Participants read payment orders" on public.payment_orders
  for select to authenticated
  using (
    customer_id = auth.uid()
    or exists (select 1 from public.priest_profiles pp where pp.id = priest_id and pp.user_id = auth.uid())
    or exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active)
  );
create policy "Admins manage payment orders" on public.payment_orders
  for all to authenticated
  using (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active))
  with check (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active));

create policy "Admins read payment events" on public.payment_events
  for select to authenticated
  using (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active));

create policy "Priests and admins read earnings" on public.provider_earnings
  for select to authenticated
  using (
    exists (select 1 from public.priest_profiles pp where pp.id = priest_id and pp.user_id = auth.uid())
    or exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active)
  );
create policy "Admins manage earnings" on public.provider_earnings
  for all to authenticated
  using (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active))
  with check (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active));

create policy "Priests read own payout account" on public.payout_accounts
  for select to authenticated
  using (exists (select 1 from public.priest_profiles pp where pp.id = priest_id and pp.user_id = auth.uid()));
create policy "Admins manage payout accounts" on public.payout_accounts
  for all to authenticated
  using (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active))
  with check (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active));

create policy "Priests and admins read payouts" on public.payouts
  for select to authenticated
  using (
    exists (select 1 from public.priest_profiles pp where pp.id = priest_id and pp.user_id = auth.uid())
    or exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active)
  );
create policy "Admins manage payouts" on public.payouts
  for all to authenticated
  using (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active))
  with check (exists (select 1 from public.app_users au where au.id = auth.uid() and au.role::text in ('admin','super_admin') and au.is_active));

grant select on public.priest_services to anon, authenticated;
grant select on public.payment_orders, public.provider_earnings, public.payout_accounts, public.payouts to authenticated;
grant select, insert, update, delete on public.priest_services to authenticated;
