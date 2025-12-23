BEGIN;

-- Soportar múltiples "clientes principales" por caso (co-clientes).
-- Se implementa vía case_clients.is_primary (manteniendo cases.cliente_principal_id como "principal de contacto").

ALTER TABLE public.case_clients
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Backfill: marcar como primario el cliente_principal_id actual del caso.
INSERT INTO public.case_clients (case_id, client_profile_id, is_primary)
SELECT id, cliente_principal_id, true
FROM public.cases
WHERE cliente_principal_id IS NOT NULL
ON CONFLICT (case_id, client_profile_id)
DO UPDATE SET is_primary = EXCLUDED.is_primary;

UPDATE public.case_clients cc
SET is_primary = true
FROM public.cases c
WHERE cc.case_id = c.id
  AND c.cliente_principal_id IS NOT NULL
  AND cc.client_profile_id = c.cliente_principal_id;

-- Asegurar función helper (por compatibilidad entre entornos).
CREATE OR REPLACE FUNCTION is_analista()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'analista'
    FROM profiles
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: permitir mantener case_clients (insert/update) a admin/abogado/analista con acceso al caso.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_clients'
      AND policyname = 'Admins and abogados can update case-client mappings'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins and abogados can update case-client mappings" ON public.case_clients
        FOR UPDATE
        USING ((is_admin() OR is_abogado()) AND has_case_access(case_id))
        WITH CHECK ((is_admin() OR is_abogado()) AND has_case_access(case_id));
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_clients'
      AND policyname = 'Analistas can insert case-client mappings'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Analistas can insert case-client mappings" ON public.case_clients
        FOR INSERT
        WITH CHECK (is_analista() AND has_case_access(case_id));
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_clients'
      AND policyname = 'Analistas can update case-client mappings'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Analistas can update case-client mappings" ON public.case_clients
        FOR UPDATE
        USING (is_analista() AND has_case_access(case_id))
        WITH CHECK (is_analista() AND has_case_access(case_id));
    $policy$;
  END IF;
END $$;

COMMIT;

