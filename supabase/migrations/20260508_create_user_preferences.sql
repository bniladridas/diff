create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'midnight', 'grey', 'graphite')),
  default_repo_owner text,
  default_repo_name text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;

create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_user_preferences_updated_at();
