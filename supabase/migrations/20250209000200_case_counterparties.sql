BEGIN;

CREATE TABLE case_counterparties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rut TEXT,
  tipo TEXT NOT NULL DEFAULT 'demandado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_counterparties_case_id ON case_counterparties(case_id);

ALTER TABLE case_counterparties ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Usuarios pueden ver contrapartes de casos accesibles" ON case_counterparties
    FOR SELECT USING (
        has_case_access(case_id) OR (
            is_analista() AND EXISTS (
                SELECT 1 FROM cases
                WHERE id = case_counterparties.case_id
                AND analista_id = (SELECT id FROM get_current_profile())
            )
        )
    );

CREATE POLICY "Staff puede insertar contrapartes" ON case_counterparties
    FOR INSERT WITH CHECK (
        (is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id)
    );

CREATE POLICY "Staff puede actualizar contrapartes" ON case_counterparties
    FOR UPDATE USING (
        (is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id)
    );

CREATE POLICY "Staff puede eliminar contrapartes" ON case_counterparties
    FOR DELETE USING (
        (is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id)
    );

COMMIT;
