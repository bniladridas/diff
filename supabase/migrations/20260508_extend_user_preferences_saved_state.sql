-- Historical compatibility migration. New databases already include
-- `recent_repos` and `saved_pulls` in 20260508_create_user_preferences.sql.

alter table public.user_preferences
add column if not exists recent_repos jsonb not null default '[]'::jsonb;

alter table public.user_preferences
add column if not exists saved_pulls jsonb not null default '[]'::jsonb;
