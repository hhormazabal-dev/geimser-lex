BEGIN;

-- Campos CRM: próxima acción por caso (seguimiento operativo).
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action_title TEXT,
  ADD COLUMN IF NOT EXISTS next_action_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cases_next_action_at_idx ON public.cases(next_action_at);
CREATE INDEX IF NOT EXISTS cases_next_action_owner_id_idx ON public.cases(next_action_owner_id);

COMMIT;

