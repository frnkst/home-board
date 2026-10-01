alter type public.playlist_kind add value if not exists 'live_countdown';

create table public.live_countdowns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  target_at timestamptz not null,
  completion_text text not null check (length(completion_text) between 1 and 500),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index live_countdowns_order_idx
on public.live_countdowns (sort_order, id)
where enabled;

create trigger set_updated_at before update on public.live_countdowns
for each row execute function private.set_updated_at();

alter table public.live_countdowns enable row level security;

create policy "admin can manage" on public.live_countdowns
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select, insert, update, delete
on public.live_countdowns
to authenticated;

alter publication supabase_realtime add table public.live_countdowns;
