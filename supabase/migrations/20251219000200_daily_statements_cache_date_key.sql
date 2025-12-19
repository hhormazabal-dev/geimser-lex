-- Agrega columna derivada para ordenar por fecha (DD-MM-YYYY -> YYYYMMDD).

alter table public.daily_statements_cache
  add column if not exists date_key int generated always as (
    case
      when "date" ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$' then
        (split_part("date", '-', 3) || split_part("date", '-', 2) || split_part("date", '-', 1))::int
      else null
    end
  ) stored;

create index if not exists daily_statements_cache_court_date_key_idx
  on public.daily_statements_cache (cod_tribunal, tipo_juzgado, date_key desc);
