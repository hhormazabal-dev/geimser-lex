BEGIN;

-- Permitir que analistas (asignados al caso) puedan mantener expediente y etapas.

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cases'
      AND policyname = 'Analistas can update assigned cases'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Analistas can update assigned cases" ON public.cases
        FOR UPDATE
        USING (is_analista() AND has_case_access(id))
        WITH CHECK (is_analista() AND has_case_access(id));
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_stages'
      AND policyname = 'Analistas can insert stages'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Analistas can insert stages" ON public.case_stages
        FOR INSERT
        WITH CHECK (is_analista() AND has_case_access(case_id));
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_stages'
      AND policyname = 'Analistas can update stages'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Analistas can update stages" ON public.case_stages
        FOR UPDATE
        USING (is_analista() AND has_case_access(case_id))
        WITH CHECK (is_analista() AND has_case_access(case_id));
    $policy$;
  END IF;
END $$;

COMMIT;
