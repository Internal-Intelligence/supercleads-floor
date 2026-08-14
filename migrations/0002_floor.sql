-- SuperC Floor — sales whiteboard, follow-ups, call log, admin override.

create table if not exists profiles (
  user_id        text primary key,
  display_name   text not null,
  email          text,
  role           text not null default 'salesman',
  initials       text not null default 'SC',
  monthly_goal   integer not null default 10,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists profiles_active_idx on profiles (active);
create index if not exists profiles_email_idx on profiles (email);

create table if not exists sales (
  id             serial primary key,
  user_id        text not null references profiles (user_id) on delete cascade,
  customer_name  text,
  deal_value     numeric(12, 2) not null default 4995,
  notes          text,
  sold_on        date not null,
  sold_at        timestamptz not null default now(),
  created_by     text not null,
  updated_at     timestamptz not null default now()
);

create index if not exists sales_user_on_idx on sales (user_id, sold_on);
create index if not exists sales_sold_on_idx on sales (sold_on);

create table if not exists customers (
  id               serial primary key,
  owner_id         text not null references profiles (user_id) on delete cascade,
  name             text not null,
  phone            text,
  email            text,
  company          text,
  status           text not null default 'new',
  notes            text,
  next_follow_up   date,
  last_contacted   date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists customers_owner_idx on customers (owner_id);
create index if not exists customers_follow_idx on customers (next_follow_up);
create index if not exists customers_status_idx on customers (status);

create table if not exists calls (
  id           serial primary key,
  user_id      text not null references profiles (user_id) on delete cascade,
  customer_id  integer references customers (id) on delete set null,
  called_on    date not null,
  called_at    timestamptz not null default now(),
  outcome      text not null default 'connected',
  notes        text
);

create index if not exists calls_user_on_idx on calls (user_id, called_on);
create index if not exists calls_customer_idx on calls (customer_id);

create table if not exists floor_activity (
  id           serial primary key,
  actor_id     text not null,
  action       text not null,
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists floor_activity_created_idx on floor_activity (created_at desc);
