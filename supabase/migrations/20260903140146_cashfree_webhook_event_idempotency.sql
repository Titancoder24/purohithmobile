with ranked_events as (
  select
    id,
    row_number() over (
      partition by payment_order_id, event_type, provider_event_id
      order by received_at asc, id asc
    ) as occurrence
  from public.payment_events
  where provider_event_id is not null
)
delete from public.payment_events
where id in (
  select id from ranked_events where occurrence > 1
);

drop index if exists public.payment_events_provider_event_type_idx;

create unique index payment_events_provider_event_type_idx
  on public.payment_events (
    coalesce(payment_order_id, '00000000-0000-0000-0000-000000000000'::uuid),
    event_type,
    provider_event_id
  )
  where provider_event_id is not null;
