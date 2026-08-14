-- Drawn marker X's + hunt alerts for the physical sales board.

alter table profiles add column if not exists marker_color text not null default '#0077c8';

alter table sales add column if not exists marker_color text;
alter table sales add column if not exists stroke_json text;

create table if not exists floor_alerts (
  id           serial primary key,
  actor_id     text not null,
  actor_name   text not null,
  target_id    text,
  message      text not null,
  kind         text not null default 'hunt',
  created_at   timestamptz not null default now()
);

create index if not exists floor_alerts_target_idx on floor_alerts (target_id, created_at desc);
create index if not exists floor_alerts_created_idx on floor_alerts (created_at desc);
