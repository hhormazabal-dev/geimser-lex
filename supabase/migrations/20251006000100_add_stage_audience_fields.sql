BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'stage_audience_type'
  ) THEN
    CREATE TYPE stage_audience_type AS ENUM ('preparatoria', 'juicio');
  END IF;
END
$$;

ALTER TABLE case_stages
  ADD COLUMN IF NOT EXISTS audiencia_tipo stage_audience_type;

ALTER TABLE case_stages
  ADD COLUMN IF NOT EXISTS requiere_testigos BOOLEAN DEFAULT false;

UPDATE case_stages
SET requiere_testigos = false
WHERE requiere_testigos IS NULL;

ALTER TABLE case_stages
  ALTER COLUMN requiere_testigos SET NOT NULL;

COMMIT;
