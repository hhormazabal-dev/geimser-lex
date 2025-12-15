-- Campos para registrar estado y fecha de sentencia en casos

-- 1) Enum para estado de sentencia (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_sentence_status') THEN
    CREATE TYPE case_sentence_status AS ENUM (
      'no_registra',
      'pendiente',
      'programada',
      'dictada'
    );
  END IF;
END $$;

-- 2) Columnas en tabla cases (si no existen)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS sentencia_estado case_sentence_status DEFAULT 'no_registra',
  ADD COLUMN IF NOT EXISTS sentencia_fecha DATE;

