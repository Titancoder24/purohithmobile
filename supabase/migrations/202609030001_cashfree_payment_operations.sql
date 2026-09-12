alter table public.payment_orders
  add column if not exists customer_receipt_token uuid not null default gen_random_uuid();
create unique index if not exists payment_orders_customer_receipt_token_idx
  on public.payment_orders (customer_receipt_token);

create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid not null references public.app_users(id) on delete restrict,
  priest_id uuid references public.priest_profiles(id) on delete restrict,
  provider text not null default 'cashfree' check (provider = 'cashfree'),
  provider_dispute_id text,
  event_type text not null,
  status text not null default 'open' check (status in ('open','under_review','won','lost','closed')),
  amount_paise bigint check (amount_paise is null or amount_paise > 0),
  reason text,
  provider_payload jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_dispute_id)
);

create index if not exists payment_disputes_status_created_idx
  on public.payment_disputes (status, created_at desc);
create index if not exists payment_disputes_order_idx
  on public.payment_disputes (payment_order_id, created_at desc);

alter table public.payment_disputes enable row level security;

create policy "Participants read payment disputes" on public.payment_disputes
  for select to authenticated
  using (
    customer_id = auth.uid()
    or exists (
      select 1 from public.priest_profiles pp
      where pp.id = priest_id and pp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.app_users au
      where au.id = auth.uid()
        and au.role::text in ('admin','super_admin')
        and au.is_active
    )
  );

create policy "Admins manage payment disputes" on public.payment_disputes
  for all to authenticated
  using (
    exists (
      select 1 from public.app_users au
      where au.id = auth.uid()
        and au.role::text in ('admin','super_admin')
        and au.is_active
    )
  )
  with check (
    exists (
      select 1 from public.app_users au
      where au.id = auth.uid()
        and au.role::text in ('admin','super_admin')
        and au.is_active
    )
  );

grant select on public.payment_disputes to authenticated;
