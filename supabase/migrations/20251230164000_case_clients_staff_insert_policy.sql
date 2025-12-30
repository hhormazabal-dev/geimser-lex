BEGIN;

-- Permitir que admin/abogado inserten vínculos en case_clients (necesario para upsert de cliente principal/co-clientes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_clients'
      AND policyname = 'Admins and abogados can insert case-client mappings'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins and abogados can insert case-client mappings" ON public.case_clients
        FOR INSERT
        WITH CHECK ((is_admin() OR is_abogado()) AND has_case_access(case_id));
    $policy$;
  END IF;
END $$;

COMMIT;

