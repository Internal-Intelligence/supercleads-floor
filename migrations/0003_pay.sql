-- SuperC-Leads commission flags on each ownership close.

alter table sales add column if not exists intelligence boolean not null default false;
alter table sales add column if not exists pain_killer boolean not null default false;
alter table sales add column if not exists speed_close boolean not null default false;
alter table sales add column if not exists first_demo_on date;
alter table sales add column if not exists refunded boolean not null default false;
alter table sales add column if not exists refunded_at timestamptz;

create index if not exists sales_refunded_idx on sales (user_id, refunded);
