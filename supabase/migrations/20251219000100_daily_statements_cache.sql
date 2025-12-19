-- Cache/auditoría de Estado Diario (PJUD).

create table if not exists public.daily_statements_cache (
  id uuid primary key default gen_random_uuid(),
  cod_tribunal text not null,
  tipo_juzgado text not null,
  nombre_tribunal text null,
  date text not null, -- DD-MM-YYYY
  item_count int not null default 0,
  payload_json jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique(cod_tribunal, tipo_juzgado, date)
);

create index if not exists daily_statements_cache_court_date_idx
  on public.daily_statements_cache (cod_tribunal, tipo_juzgado, date);

create index if not exists daily_statements_cache_fetched_at_idx
  on public.daily_statements_cache (fetched_at desc);

