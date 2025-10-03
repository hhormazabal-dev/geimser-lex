-- Seed data for LEXCHILE
-- This file creates test users and sample data for development

-- Insert test users into auth.users (this would normally be done through Supabase Auth)
-- Note: In production, users are created through the authentication flow

-- Create sample profiles
INSERT INTO profiles (id, user_id, role, nombre, rut, telefono) VALUES
-- Admin
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'admin_firma', 'María González', '12345678-9', '+56912345678'),
-- Abogados
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'abogado', 'Carlos Rodríguez', '23456789-0', '+56923456789'),
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'abogado', 'Ana Martínez', '34567890-1', '+56934567890'),
-- Cliente
('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'cliente', 'Juan Pérez', '45678901-2', '+56945678901');

-- Create sample cases
INSERT INTO cases (id, numero_causa, caratulado, materia, tribunal, region, comuna, rut_cliente, nombre_cliente, contraparte, etapa_actual, estado, fecha_inicio, abogado_responsable, prioridad, valor_estimado, observaciones) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'C-1234-2024', 'Pérez con Empresa ABC', 'Laboral', '1° Juzgado del Trabajo de Santiago', 'Metropolitana', 'Santiago', '45678901-2', 'Juan Pérez', 'Empresa ABC S.A.', 'Contestación', 'activo', '2024-01-15', '550e8400-e29b-41d4-a716-446655440002', 'alta', 5000000.00, 'Caso de despido injustificado'),
('660e8400-e29b-41d4-a716-446655440002', 'C-5678-2024', 'Constructora XYZ con Municipalidad', 'Civil', '2° Juzgado Civil de Santiago', 'Metropolitana', 'Santiago', '78901234-5', 'Constructora XYZ Ltda.', 'Municipalidad de Santiago', 'Audiencia Preparación', 'activo', '2024-02-01', '550e8400-e29b-41d4-a716-446655440003', 'media', 15000000.00, 'Demanda por incumplimiento contractual');

-- Create case-client mappings
INSERT INTO case_clients (case_id, client_profile_id) VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004');

-- Create case stages (timeline procesal)
INSERT INTO case_stages (id, case_id, etapa, descripcion, estado, fecha_programada, fecha_cumplida, responsable_id, es_publica, orden) VALUES
-- Caso 1 - Pérez con Empresa ABC
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Ingreso Demanda', 'Presentación de demanda laboral', 'completado', '2024-01-15', '2024-01-15', '550e8400-e29b-41d4-a716-446655440002', true, 1),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Notificación', 'Notificación a la empresa demandada', 'completado', '2024-01-20', '2024-01-22', '550e8400-e29b-41d4-a716-446655440002', true, 2),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'Contestación', 'Período para contestación de la demanda', 'en_proceso', '2024-02-05', NULL, '550e8400-e29b-41d4-a716-446655440002', true, 3),
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440001', 'Audiencia Preparación', 'Audiencia preparatoria', 'pendiente', '2024-02-20', NULL, '550e8400-e29b-41d4-a716-446655440002', true, 4),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440001', 'Audiencia Juicio', 'Audiencia de juicio', 'pendiente', '2024-03-15', NULL, '550e8400-e29b-41d4-a716-446655440002', true, 5),

-- Caso 2 - Constructora XYZ con Municipalidad
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440002', 'Ingreso Demanda', 'Presentación de demanda civil', 'completado', '2024-02-01', '2024-02-01', '550e8400-e29b-41d4-a716-446655440003', true, 1),
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440002', 'Notificación', 'Notificación a la municipalidad', 'completado', '2024-02-05', '2024-02-08', '550e8400-e29b-41d4-a716-446655440003', true, 2),
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440002', 'Contestación', 'Contestación de la demanda', 'completado', '2024-02-20', '2024-02-18', '550e8400-e29b-41d4-a716-446655440003', true, 3),
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440002', 'Audiencia Preparación', 'Audiencia preparatoria', 'en_proceso', '2024-03-10', NULL, '550e8400-e29b-41d4-a716-446655440003', true, 4);

-- Create sample notes
INSERT INTO notes (id, case_id, author_id, tipo, contenido) VALUES
-- Notas privadas
('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'privada', 'Revisión inicial del caso: El cliente presenta evidencia sólida de despido injustificado. Recomiendo proceder con la demanda.'),
('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'privada', 'Estrategia: Enfocar en la falta de procedimiento disciplinario previo y la ausencia de causa justificada.'),
('880e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'privada', 'Análisis contractual: Cláusulas de penalización por incumplimiento claramente establecidas.'),

-- Nota pública
('880e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'publica', 'Estimado Sr. Pérez, hemos presentado exitosamente su demanda laboral. El proceso se encuentra en etapa de notificación a la empresa. Le mantendremos informado de todos los avances.');

-- Create sample information requests
INSERT INTO info_requests (id, case_id, creador_id, tipo, descripcion, fecha_limite, estado) VALUES
('990e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'documento', 'Necesitamos que nos proporcione copia de su contrato de trabajo y las últimas 3 liquidaciones de sueldo.', '2024-02-10', 'pendiente'),
('990e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'dato', 'Por favor confirme la fecha exacta de su despido y si recibió alguna comunicación escrita al respecto.', '2024-02-08', 'recibido');

-- Create sample audit log entries
INSERT INTO audit_log (actor_id, action, entity_type, entity_id, diff_json, ip_address, user_agent) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'CREATE', 'case', '660e8400-e29b-41d4-a716-446655440001', '{"caratulado": "Pérez con Empresa ABC", "estado": "activo"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('550e8400-e29b-41d4-a716-446655440002', 'UPDATE', 'case_stage', '770e8400-e29b-41d4-a716-446655440002', '{"estado": {"from": "pendiente", "to": "completado"}}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('550e8400-e29b-41d4-a716-446655440003', 'CREATE', 'case', '660e8400-e29b-41d4-a716-446655440002', '{"caratulado": "Constructora XYZ con Municipalidad", "estado": "activo"}', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

-- Update case etapa_actual based on current stages
UPDATE cases SET etapa_actual = 'Contestación' WHERE id = '660e8400-e29b-41d4-a716-446655440001';
UPDATE cases SET etapa_actual = 'Audiencia Preparación' WHERE id = '660e8400-e29b-41d4-a716-446655440002';

-- Create some sample portal tokens (expired for security)
INSERT INTO portal_tokens (token, case_id, client_profile_id, expires_at, used_at) VALUES
('sample_expired_token_123', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', '2024-01-01 00:00:00+00', '2024-01-01 12:00:00+00');

-- Add some sample documents metadata (files would be in Supabase Storage)
INSERT INTO documents (id, case_id, uploader_id, nombre, tipo_mime, size_bytes, url, visibilidad) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Demanda_Laboral_Perez.pdf', 'application/pdf', 1024000, '/storage/cases/660e8400-e29b-41d4-a716-446655440001/demanda.pdf', 'privado'),
('aa0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'Contrato_Trabajo.pdf', 'application/pdf', 512000, '/storage/cases/660e8400-e29b-41d4-a716-446655440001/contrato.pdf', 'cliente'),
('aa0e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'Contrato_Construccion.pdf', 'application/pdf', 2048000, '/storage/cases/660e8400-e29b-41d4-a716-446655440002/contrato_construccion.pdf', 'privado');
