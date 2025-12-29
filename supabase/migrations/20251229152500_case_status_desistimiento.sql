-- Nuevo estado: Terminada - Desistida por Demandante (con fecha de desistimiento).
-- Nota: ALTER TYPE ... ADD VALUE no debe ejecutarse dentro de un bloque transaccional.
ALTER TYPE public.case_status
  ADD VALUE IF NOT EXISTS 'terminado_desistido_demandante';

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS fecha_desistimiento DATE;
