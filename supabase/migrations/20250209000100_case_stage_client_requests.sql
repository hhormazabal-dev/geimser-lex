BEGIN;

ALTER TYPE stage_payment_status ADD VALUE IF NOT EXISTS 'solicitado';

ALTER TABLE case_stages
  ADD COLUMN solicitado_por UUID REFERENCES profiles(id),
  ADD COLUMN solicitado_at TIMESTAMPTZ;

ALTER TABLE cases
  ADD COLUMN alcance_cliente_solicitado SMALLINT DEFAULT 0,
  ADD COLUMN alcance_cliente_autorizado SMALLINT DEFAULT 0;

COMMIT;
