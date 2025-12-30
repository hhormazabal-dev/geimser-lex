BEGIN;

-- Excepción controlada: casos legacy "terminado" sin PDF.
-- Esto permite mantenerlos en estado "terminado" sin bloquear la migración,
-- pero mantiene la regla por defecto: si no se marca explícitamente la excepción,
-- "terminado" requiere `termino_documento_id`.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS termino_sin_documento BOOLEAN NOT NULL DEFAULT false;

-- Backfill: si ya existen casos "terminado" sin documento, marcarlos como excepción.
UPDATE public.cases
SET termino_sin_documento = true
WHERE estado = 'terminado'
  AND termino_documento_id IS NULL;

-- Re-crear constraint con excepción.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cases_termino_doc_required_when_terminado'
  ) THEN
    ALTER TABLE public.cases
      DROP CONSTRAINT cases_termino_doc_required_when_terminado;
  END IF;

  ALTER TABLE public.cases
    ADD CONSTRAINT cases_termino_doc_required_when_terminado
    CHECK (
      estado IS DISTINCT FROM 'terminado'
      OR termino_documento_id IS NOT NULL
      OR termino_sin_documento = true
    );
END $$;

COMMIT;

