-- SuperC follow-up sequences: Hunt / Booked / Revive cadences.

alter table customers add column if not exists sequence_key text;
alter table customers add column if not exists sequence_started_on date;

create table if not exists follow_up_steps (
  id            serial primary key,
  customer_id   integer not null references customers (id) on delete cascade,
  owner_id      text not null,
  sequence_key  text not null,
  step_index    integer not null,
  title         text not null,
  action        text not null default 'call',
  due_on        date not null,
  done_at       timestamptz,
  skipped_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists follow_up_steps_due_idx
  on follow_up_steps (owner_id, due_on)
  where done_at is null and skipped_at is null;

create index if not exists follow_up_steps_customer_idx
  on follow_up_steps (customer_id, step_index);
