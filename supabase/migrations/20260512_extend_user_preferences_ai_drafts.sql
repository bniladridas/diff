-- Historical compatibility migration. New databases already include
-- `ai_drafts` in 20260508_create_user_preferences.sql.

alter table public.user_preferences
add column if not exists ai_drafts jsonb not null default '[]'::jsonb;
