-- Contractor desk: W-9 / 1099 packet, time off, sick, inbox, pay deposit.

alter table profiles add column if not exists legal_name text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists city text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists emergency_name text;
alter table profiles add column if not exists emergency_phone text;
alter table profiles add column if not exists work_hours text;
alter table profiles add column if not exists ic_signed_at timestamptz;
alter table profiles add column if not exists pay_plan_signed_at timestamptz;

create table if not exists w9_forms (
  user_id            text primary key references profiles (user_id) on delete cascade,
  legal_name         text not null default '',
  business_name      text,
  tax_class          text not null default 'individual',
  llc_tax_class      text,
  exempt_payee_code  text,
  fatca_code         text,
  address_line       text,
  city               text,
  state              text,
  zip                text,
  tin_type           text not null default 'ssn',
  tin_last4          text,
  tin_enc            text,
  certify            boolean not null default false,
  signature_name     text,
  signed_on          date,
  status             text not null default 'draft',
  admin_note         text,
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  reviewed_by        text,
  updated_at         timestamptz not null default now()
);

create table if not exists bank_accounts (
  user_id        text primary key references profiles (user_id) on delete cascade,
  bank_name      text,
  account_type   text,
  holder_name    text,
  routing_last4  text,
  account_last4  text,
  routing_enc    text,
  account_enc    text,
  status         text not null default 'draft',
  updated_at     timestamptz not null default now()
);

create table if not exists time_requests (
  id           serial primary key,
  user_id      text not null references profiles (user_id) on delete cascade,
  kind         text not null,
  start_on     date not null,
  end_on       date not null,
  note         text,
  status       text not null default 'pending',
  admin_note   text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  text
);

create index if not exists time_requests_user_idx on time_requests (user_id, start_on);
create index if not exists time_requests_status_idx on time_requests (status, start_on);

create table if not exists desk_presence (
  user_id     text primary key references profiles (user_id) on delete cascade,
  status      text not null default 'on',
  note        text,
  until_on    date,
  updated_at  timestamptz not null default now()
);

create table if not exists desk_threads (
  id               serial primary key,
  user_id          text not null references profiles (user_id) on delete cascade,
  topic            text not null default 'other',
  subject          text not null,
  status           text not null default 'open',
  last_at          timestamptz not null default now(),
  salesman_unread  integer not null default 0,
  admin_unread     integer not null default 0
);

create index if not exists desk_threads_user_idx on desk_threads (user_id, last_at desc);
create index if not exists desk_threads_admin_idx on desk_threads (admin_unread desc, last_at desc);

create table if not exists desk_messages (
  id          serial primary key,
  thread_id   integer not null references desk_threads (id) on delete cascade,
  author_id   text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists desk_messages_thread_idx on desk_messages (thread_id, created_at);
