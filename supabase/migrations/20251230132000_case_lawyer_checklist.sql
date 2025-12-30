BEGIN;

-- Checklist interno del abogado: control profesional no visible para clientes.
CREATE TABLE IF NOT EXISTS public.case_lawyer_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS case_lawyer_checklist_case_idx
  ON public.case_lawyer_checklist_items(case_id, sort_order, created_at);

ALTER TABLE public.case_lawyer_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checklist: staff select for case access" ON public.case_lawyer_checklist_items
  FOR SELECT USING ((is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id));

CREATE POLICY "Checklist: staff insert for case access" ON public.case_lawyer_checklist_items
  FOR INSERT WITH CHECK ((is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id));

CREATE POLICY "Checklist: staff update for case access" ON public.case_lawyer_checklist_items
  FOR UPDATE USING ((is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id));

CREATE POLICY "Checklist: staff delete for case access" ON public.case_lawyer_checklist_items
  FOR DELETE USING ((is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id));

COMMIT;

