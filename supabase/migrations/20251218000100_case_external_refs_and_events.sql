-- Vinculación a fuentes externas (PJUD u otras) y bitácora de eventos del caso.
-- Nota: este esquema es una base para sincronización; la extracción PJUD puede implementarse después.

create table if not exists public.case_external_refs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  provider text not null,
  external_id text null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'linked',
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(case_id, provider)
);

create index if not exists case_external_refs_case_id_idx on public.case_external_refs(case_id);
create index if not exists case_external_refs_provider_idx on public.case_external_refs(provider);

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  provider text not null default 'manual',
  external_event_id text null,
  kind text not null,
  title text not null,
  occurred_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(case_id, provider, external_event_id)
);

create index if not exists case_events_case_id_idx on public.case_events(case_id);
create index if not exists case_events_occurred_at_idx on public.case_events(occurred_at desc);

