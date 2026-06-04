-- Esquema OPCIONAL para persistir el historial en Supabase.
-- Solo es necesario si completás NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en .env.
-- Ejecutalo en: Supabase Dashboard -> SQL Editor.

create table if not exists public.valuations (
  id            text primary key,
  url           text not null,
  title         text,
  neighborhood  text,
  "propertyType" text,
  "priceUsd"     numeric not null,
  "surfaceM2"    numeric not null,
  "pricePerM2"   numeric not null,
  "marketPricePerM2" numeric not null,
  deviation     numeric not null,
  verdict       text not null,
  "analyzedAt"   timestamptz not null default now()
);

-- Evita duplicados por URL (la app hace upsert onConflict: 'url').
create unique index if not exists valuations_url_key on public.valuations (url);

-- App personal de un solo usuario sin login: habilitamos acceso anónimo.
-- Si más adelante agregás auth, restringí estas policies por auth.uid().
alter table public.valuations enable row level security;

drop policy if exists "valuations_anon_all" on public.valuations;
create policy "valuations_anon_all"
  on public.valuations
  for all
  using (true)
  with check (true);
