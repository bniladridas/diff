alter table public.user_preferences
add column if not exists ai_drafts jsonb not null default '[]'::jsonb;
