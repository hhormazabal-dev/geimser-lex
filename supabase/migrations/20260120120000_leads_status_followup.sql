BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_notes TEXT,
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_caratulado TEXT,
  ADD COLUMN IF NOT EXISTS case_materia TEXT,
  ADD COLUMN IF NOT EXISTS case_descripcion TEXT,
  ADD COLUMN IF NOT EXISTS case_prioridad case_priority,
  ADD COLUMN IF NOT EXISTS case_contraparte TEXT,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_follow_up_idx
  ON public.leads (next_follow_up_at);

CREATE INDEX IF NOT EXISTS leads_case_idx
  ON public.leads (case_id);

COMMIT;
