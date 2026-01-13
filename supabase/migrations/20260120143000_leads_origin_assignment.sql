BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origin TEXT,
  ADD COLUMN IF NOT EXISTS assigned_lawyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_origin_idx
  ON public.leads (origin);

CREATE INDEX IF NOT EXISTS leads_assigned_idx
  ON public.leads (assigned_lawyer_id);

COMMIT;
