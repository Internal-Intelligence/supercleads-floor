-- Built-in SuperC-Leads CRM: pipeline fields, notes, sale link.

alter table customers add column if not exists source text;
alter table customers add column if not exists city text;
alter table customers add column if not exists monthly_spend numeric(12, 2);
alter table customers add column if not exists current_provider text;
alter table customers add column if not exists pain_notes text;
alter table customers add column if not exists first_demo_on date;

alter table sales add column if not exists customer_id integer references customers (id) on delete set null;
create index if not exists sales_customer_idx on sales (customer_id);

create table if not exists customer_notes (
  id           serial primary key,
  customer_id  integer not null references customers (id) on delete cascade,
  author_id    text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists customer_notes_customer_idx on customer_notes (customer_id, created_at desc);
