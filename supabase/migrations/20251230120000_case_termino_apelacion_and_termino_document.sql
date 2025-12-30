-- Estado adicional: Terminado - Apelación (mantiene seguimiento sin cerrar completamente).
-- Nota: ALTER TYPE ... ADD VALUE no debe ejecutarse dentro de un bloque transaccional.
ALTER TYPE public.case_status
  ADD VALUE IF NOT EXISTS 'terminado_apelacion';

BEGIN;

-- Documento de término: obligatorio cuando el estado del caso es 'terminado'.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS termino_documento_id UUID REFERENCES public.documents(id);

-- Enforce: si el caso está terminado, debe tener documento de término.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cases_termino_doc_required_when_terminado'
  ) THEN
    ALTER TABLE public.cases
      ADD CONSTRAINT cases_termino_doc_required_when_terminado
      CHECK (estado IS DISTINCT FROM 'terminado' OR termino_documento_id IS NOT NULL);
  END IF;
END $$;

-- Validación cruzada: el documento marcado como "término" debe pertenecer al mismo caso.
CREATE OR REPLACE FUNCTION public.enforce_termino_documento_case_match()
RETURNS TRIGGER AS $$
DECLARE
  doc_case_id UUID;
BEGIN
  IF NEW.termino_documento_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.case_id INTO doc_case_id
  FROM public.documents d
  WHERE d.id = NEW.termino_documento_id;

  IF doc_case_id IS NULL THEN
    RAISE EXCEPTION 'Documento de término no existe (%)', NEW.termino_documento_id
      USING ERRCODE = '23503';
  END IF;

  IF doc_case_id <> NEW.id THEN
    RAISE EXCEPTION 'Documento de término (%) no pertenece al caso (%)', NEW.termino_documento_id, NEW.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_termino_documento_case_match ON public.cases;
CREATE TRIGGER trg_enforce_termino_documento_case_match
  BEFORE INSERT OR UPDATE OF termino_documento_id ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_termino_documento_case_match();

CREATE INDEX IF NOT EXISTS cases_termino_documento_id_idx ON public.cases(termino_documento_id);

COMMIT;
