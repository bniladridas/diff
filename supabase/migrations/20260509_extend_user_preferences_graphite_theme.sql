-- Historical compatibility migration. New databases already include
-- `graphite` in 20260508_create_user_preferences.sql.

alter table public.user_preferences
drop constraint if exists user_preferences_theme_check;

alter table public.user_preferences
add constraint user_preferences_theme_check
check (theme in ('dark', 'midnight', 'grey', 'graphite'));
