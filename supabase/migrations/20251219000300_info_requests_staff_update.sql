BEGIN;

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

CREATE POLICY "Staff can update requests of accessible cases" ON info_requests
  FOR UPDATE USING (
    (is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id)
  );

COMMIT;

