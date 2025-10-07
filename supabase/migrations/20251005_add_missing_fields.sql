-- 🧩 Migración para alinear tu BD con el código

-- 1) Asegurar que el enum user_role tenga 'analista'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'analista'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'analista';
  END IF;
END $$;

-- 2) Crear enum case_workflow_state si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_workflow_state') THEN
    CREATE TYPE case_workflow_state AS ENUM ('preparacion','en_revision','activo','cerrado');
  END IF;
END $$;

-- 3) Agregar columnas faltantes en cases (si no existen)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS analista_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_principal_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workflow_state case_workflow_state DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS validado_at timestamptz;

-- (Opcional) normalizar defaults si hiciera falta
ALTER TABLE public.cases
  ALTER COLUMN workflow_state SET DEFAULT 'activo';
