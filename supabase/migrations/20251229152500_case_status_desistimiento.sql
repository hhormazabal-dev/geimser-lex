BEGIN;

-- Nuevo estado: Terminada - Desistida por Demandante (con fecha de desistimiento).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'case_status'
      AND e.enumlabel = 'terminado_desistido_demandante'
  ) THEN
    EXECUTE 'ALTER TYPE public.case_status ADD VALUE ''terminado_desistido_demandante''';
  END IF;
END $$;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS fecha_desistimiento DATE;

COMMIT;

