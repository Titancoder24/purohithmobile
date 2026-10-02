alter table public.booking_messages
  add column if not exists kind text not null default 'text',
  add column if not exists call_meta jsonb;

alter table public.booking_messages
  drop constraint if exists booking_messages_kind_check;
alter table public.booking_messages
  add constraint booking_messages_kind_check check (kind in ('text', 'call'));

alter table public.booking_messages
  drop constraint if exists booking_messages_call_meta_check;
alter table public.booking_messages
  add constraint booking_messages_call_meta_check check (
    (kind = 'text' and call_meta is null)
    or (
      kind = 'call'
      and jsonb_typeof(call_meta) = 'object'
      and call_meta->>'outcome' in ('completed', 'missed', 'declined')
      and coalesce((call_meta->>'duration_seconds')::int, 0) between 0 and 86400
    )
  );
