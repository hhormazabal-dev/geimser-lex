BEGIN;

-- Campos estructurados para notificación de la demanda.
-- Nota: se mantienen como TEXT para compatibilidad con valores actuales ('realizada' | 'no_realizada').
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS notificacion_demanda_estado TEXT,
  ADD COLUMN IF NOT EXISTS notificacion_demanda_fecha DATE;

COMMIT;

