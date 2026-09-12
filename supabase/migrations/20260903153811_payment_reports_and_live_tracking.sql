create table if not exists public.payment_reports (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null unique references public.payment_orders(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  customer_id uuid not null references public.app_users(id) on delete restrict,
  priest_id uuid not null references public.priest_profiles(id) on delete restrict,
  invoice_number text not null unique,
  invoice_html text not null,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  provider text not null default 'cashfree',
  provider_payment_id text,
  paid_at timestamptz not null,
  report_data jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_reports_customer_generated_idx
  on public.payment_reports (customer_id, generated_at desc);
create index if not exists payment_reports_priest_generated_idx
  on public.payment_reports (priest_id, generated_at desc);

create table if not exists public.booking_tracking_sessions (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.app_users(id) on delete cascade,
  priest_id uuid not null references public.priest_profiles(id) on delete cascade,
  status text not null default 'disabled' check (status in ('disabled', 'waiting', 'active', 'stopped', 'expired')),
  customer_consented_at timestamptz,
  priest_consented_at timestamptz,
  started_at timestamptz,
  stopped_at timestamptz,
  expires_at timestamptz,
  last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_tracking_priest_status_idx
  on public.booking_tracking_sessions (priest_id, status);

create table if not exists public.booking_locations (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  priest_id uuid not null references public.priest_profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters between 0 and 10000),
  heading_degrees double precision check (heading_degrees is null or heading_degrees between 0 and 360),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists booking_locations_booking_recorded_idx
  on public.booking_locations (booking_id, recorded_at desc);

alter table public.payment_reports enable row level security;
alter table public.booking_tracking_sessions enable row level security;
alter table public.booking_locations enable row level security;

revoke all on public.payment_reports from anon, authenticated;
revoke all on public.booking_tracking_sessions from anon, authenticated;
revoke all on public.booking_locations from anon, authenticated;
grant select on public.payment_reports to authenticated;
grant select on public.booking_tracking_sessions to authenticated;
grant select on public.booking_locations to authenticated;

drop policy if exists "Payment participants and admins can view reports" on public.payment_reports;
create policy "Payment participants and admins can view reports"
  on public.payment_reports for select to authenticated
  using (
    customer_id = (select auth.uid())
    or exists (
      select 1 from public.priest_profiles pp
      where pp.id = payment_reports.priest_id and pp.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid()) and au.role in ('admin', 'super_admin') and au.is_active
    )
  );

drop policy if exists "Booking participants and admins can view tracking sessions" on public.booking_tracking_sessions;
create policy "Booking participants and admins can view tracking sessions"
  on public.booking_tracking_sessions for select to authenticated
  using (
    customer_id = (select auth.uid())
    or exists (
      select 1 from public.priest_profiles pp
      where pp.id = booking_tracking_sessions.priest_id and pp.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid()) and au.role in ('admin', 'super_admin') and au.is_active
    )
  );

drop policy if exists "Booking participants and admins can view locations" on public.booking_locations;
create policy "Booking participants and admins can view locations"
  on public.booking_locations for select to authenticated
  using (
    exists (
      select 1 from public.booking_tracking_sessions s
      where s.booking_id = booking_locations.booking_id
        and (
          s.customer_id = (select auth.uid())
          or exists (
            select 1 from public.priest_profiles pp
            where pp.id = s.priest_id and pp.user_id = (select auth.uid())
          )
          or exists (
            select 1 from public.app_users au
            where au.id = (select auth.uid()) and au.role in ('admin', 'super_admin') and au.is_active
          )
        )
    )
  );
