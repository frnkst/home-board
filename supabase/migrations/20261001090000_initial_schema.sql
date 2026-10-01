create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.admin_config (
  singleton boolean primary key default true check (singleton),
  github_provider_id bigint not null check (github_provider_id > 0)
);
revoke all on private.admin_config from public, anon, authenticated;

create or replace function private.set_admin_github_user_id(provider_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.admin_config (singleton, github_provider_id)
  values (true, provider_id)
  on conflict (singleton) do update
  set github_provider_id = excluded.github_provider_id;
$$;
revoke all on function private.set_admin_github_user_id(bigint) from public;
grant execute on function private.set_admin_github_user_id(bigint) to service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.identities as identity
    cross join private.admin_config as config
    where identity.user_id = auth.uid()
      and identity.provider = 'github'
      and identity.provider_id ~ '^[1-9][0-9]*$'
      and identity.provider_id::numeric = config.github_provider_id
  );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create type public.playlist_kind as enum (
  'overview',
  'weather',
  'departures',
  'events',
  'countdowns',
  'markets',
  'photos',
  'webpage',
  'custom_text'
);

create table public.app_settings (
  id boolean primary key default true check (id),
  household_name text not null default 'Zuhause'
    check (length(household_name) between 1 and 80),
  timezone text not null default 'Europe/Zurich'
    check (timezone = 'Europe/Zurich'),
  locale text not null default 'de-CH' check (locale = 'de-CH'),
  weather_place_name text not null default 'Zürich'
    check (length(weather_place_name) between 1 and 120),
  weather_latitude double precision not null default 47.3769
    check (weather_latitude between -90 and 90),
  weather_longitude double precision not null default 8.5417
    check (weather_longitude between -180 and 180),
  weather_forecast_days integer not null default 7
    check (weather_forecast_days between 1 and 16),
  transport_stop_name text not null default 'Zürich HB'
    check (length(transport_stop_name) between 1 and 120),
  transport_stop_id text not null default '8503000'
    check (length(transport_stop_id) between 1 and 80),
  transport_departure_count integer not null default 10
    check (transport_departure_count between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  description text check (description is null or length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  all_day boolean not null default false,
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  recurrence jsonb check (
    recurrence is null
    or (
      recurrence ? 'frequency'
      and recurrence->>'frequency' in ('daily', 'weekly', 'monthly', 'yearly')
    )
  ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.countdowns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  target_at timestamptz not null,
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.market_symbols (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique check (symbol ~ '^[A-Z0-9.^=-]{1,24}$'),
  label text not null check (length(label) between 1 and 80),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique
    check (length(storage_path) between 1 and 512 and storage_path !~ '^/'),
  caption text check (caption is null or length(caption) <= 240),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webpages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  url text not null check (url ~ '^https?://'),
  refresh_seconds integer not null default 300
    check (refresh_seconds between 30 and 86400),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.custom_texts (
  id uuid primary key default gen_random_uuid(),
  title text check (title is null or length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 10000),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlist_entries (
  id uuid primary key default gen_random_uuid(),
  kind public.playlist_kind not null,
  reference_id uuid,
  duration_seconds integer not null default 30
    check (duration_seconds between 5 and 3600),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.display_state (
  id boolean primary key default true check (id),
  playlist_started_at timestamptz not null default now(),
  paused_at timestamptz,
  forced_entry_id uuid references public.playlist_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true);
insert into public.display_state (id) values (true);

create index events_time_range_idx on public.events (starts_at, ends_at)
where enabled;
create index countdowns_order_idx on public.countdowns (sort_order, id)
where enabled;
create index market_symbols_order_idx on public.market_symbols (sort_order, id)
where enabled;
create index photos_order_idx on public.photos (sort_order, id)
where enabled;
create index webpages_order_idx on public.webpages (sort_order, id)
where enabled;
create index custom_texts_order_idx on public.custom_texts (sort_order, id)
where enabled;
create index playlist_entries_order_idx
on public.playlist_entries (sort_order, id)
where enabled;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_settings', 'events', 'countdowns', 'market_symbols', 'photos',
    'webpages', 'custom_texts', 'playlist_entries', 'display_state'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function private.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

alter table public.app_settings enable row level security;
alter table public.events enable row level security;
alter table public.countdowns enable row level security;
alter table public.market_symbols enable row level security;
alter table public.photos enable row level security;
alter table public.webpages enable row level security;
alter table public.custom_texts enable row level security;
alter table public.playlist_entries enable row level security;
alter table public.display_state enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_settings', 'events', 'countdowns', 'market_symbols', 'photos',
    'webpages', 'custom_texts', 'playlist_entries', 'display_state'
  ]
  loop
    execute format(
      'create policy "admin can manage" on public.%I
       for all to authenticated
       using ((select private.is_admin()))
       with check ((select private.is_admin()))',
      table_name
    );
  end loop;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "admin can read private photos"
on storage.objects for select to authenticated
using (bucket_id = 'photos' and (select private.is_admin()));

create policy "admin can upload private photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'photos' and (select private.is_admin()));

create policy "admin can update private photos"
on storage.objects for update to authenticated
using (bucket_id = 'photos' and (select private.is_admin()))
with check (bucket_id = 'photos' and (select private.is_admin()));

create policy "admin can delete private photos"
on storage.objects for delete to authenticated
using (bucket_id = 'photos' and (select private.is_admin()));

alter publication supabase_realtime add table
  public.app_settings,
  public.events,
  public.countdowns,
  public.market_symbols,
  public.photos,
  public.webpages,
  public.custom_texts,
  public.playlist_entries,
  public.display_state;
