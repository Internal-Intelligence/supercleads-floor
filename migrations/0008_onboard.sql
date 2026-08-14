-- First-login 1099 welcome: packet sent to admin inbox.

alter table profiles add column if not exists onboarded_at timestamptz;
