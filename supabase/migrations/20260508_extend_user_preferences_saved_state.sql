alter table public.user_preferences
add column if not exists recent_repos jsonb not null default '[]'::jsonb;

alter table public.user_preferences
add column if not exists saved_pulls jsonb not null default '[]'::jsonb;
