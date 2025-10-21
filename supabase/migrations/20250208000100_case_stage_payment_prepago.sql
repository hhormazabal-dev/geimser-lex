BEGIN;

-- Enum para el estado de pago de cada etapa del caso
CREATE TYPE stage_payment_status AS ENUM ('pendiente', 'en_proceso', 'parcial', 'pagado', 'vencido');

-- Campos de control de pagos por etapa
ALTER TABLE case_stages
  ADD COLUMN requiere_pago BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN costo_uf NUMERIC(10,2),
  ADD COLUMN porcentaje_variable NUMERIC(6,3),
  ADD COLUMN estado_pago stage_payment_status NOT NULL DEFAULT 'pendiente',
  ADD COLUMN enlace_pago TEXT,
  ADD COLUMN pagado_en TIMESTAMPTZ,
  ADD COLUMN payku_payment_id TEXT,
  ADD COLUMN notas_pago TEXT,
  ADD COLUMN monto_variable_base TEXT,
  ADD COLUMN monto_pagado_uf NUMERIC(10,2) DEFAULT 0;

-- Honrarios generales del caso y modalidad de cobro
ALTER TABLE cases
  ADD COLUMN modalidad_cobro TEXT NOT NULL DEFAULT 'prepago',
  ADD COLUMN honorario_total_uf NUMERIC(10,2),
  ADD COLUMN honorario_variable_porcentaje NUMERIC(6,3),
  ADD COLUMN honorario_variable_base TEXT,
  ADD COLUMN honorario_moneda TEXT NOT NULL DEFAULT 'UF',
  ADD COLUMN honorario_notas TEXT,
  ADD COLUMN tarifa_referencia TEXT,
  ADD COLUMN honorario_pagado_uf NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMIT;
