-- Crear tabla de auditoría avanzada
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT')),
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  user_id UUID REFERENCES profiles(id),
  user_role VARCHAR(50),
  user_email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  request_id VARCHAR(255),
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('low', 'info', 'warning', 'high', 'critical')),
  category VARCHAR(50) DEFAULT 'data_change',
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para optimizar consultas de auditoría
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_category ON audit_logs(category);

-- Índice compuesto para consultas comunes
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at);

-- Crear tabla para sesiones de usuario
CREATE TABLE user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  location_country VARCHAR(2),
  location_city VARCHAR(100),
  device_type VARCHAR(50),
  browser VARCHAR(50),
  os VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Índices para sesiones
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Crear tabla para intentos de login
CREATE TABLE login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(100),
  user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES user_sessions(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para intentos de login
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_success ON login_attempts(success);
CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at);

-- Crear tabla para configuración de seguridad
CREATE TABLE security_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar configuraciones de seguridad por defecto
INSERT INTO security_settings (setting_key, setting_value, description) VALUES
('max_login_attempts', '5', 'Máximo número de intentos de login fallidos antes de bloquear'),
('lockout_duration_minutes', '30', 'Duración del bloqueo en minutos'),
('session_timeout_hours', '8', 'Tiempo de expiración de sesión en horas'),
('password_min_length', '8', 'Longitud mínima de contraseña'),
('password_require_special', 'true', 'Requerir caracteres especiales en contraseña'),
('magic_link_expiry_hours', '24', 'Tiempo de expiración de magic links en horas'),
('max_concurrent_sessions', '3', 'Máximo número de sesiones concurrentes por usuario'),
('audit_retention_days', '365', 'Días de retención de logs de auditoría'),
('enable_ip_whitelist', 'false', 'Habilitar lista blanca de IPs'),
('allowed_file_types', '["pdf","doc","docx","jpg","jpeg","png","txt"]', 'Tipos de archivo permitidos para upload');

-- Función para limpiar logs antiguos
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
DECLARE
  retention_days INTEGER;
BEGIN
  -- Obtener configuración de retención
  SELECT (setting_value::text)::integer INTO retention_days
  FROM security_settings 
  WHERE setting_key = 'audit_retention_days' AND is_active = true;
  
  -- Usar valor por defecto si no está configurado
  IF retention_days IS NULL THEN
    retention_days := 365;
  END IF;
  
  -- Eliminar logs antiguos
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
  
  -- Eliminar intentos de login antiguos (mantener solo 90 días)
  DELETE FROM login_attempts 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Eliminar sesiones expiradas
  DELETE FROM user_sessions 
  WHERE expires_at < NOW() OR ended_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Función para detectar actividad sospechosa
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TABLE(
  alert_type VARCHAR,
  description TEXT,
  user_email VARCHAR,
  ip_address INET,
  severity VARCHAR,
  event_count BIGINT,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ
) AS $$
BEGIN
  -- Múltiples intentos de login fallidos
  RETURN QUERY
  SELECT 
    'multiple_failed_logins'::VARCHAR as alert_type,
    'Múltiples intentos de login fallidos'::TEXT as description,
    la.email::VARCHAR as user_email,
    la.ip_address,
    'high'::VARCHAR as severity,
    COUNT(*) as event_count,
    MIN(la.created_at) as first_seen,
    MAX(la.created_at) as last_seen
  FROM login_attempts la
  WHERE la.success = false 
    AND la.created_at > NOW() - INTERVAL '1 hour'
  GROUP BY la.email, la.ip_address
  HAVING COUNT(*) >= 5;
  
  -- Accesos desde múltiples IPs en poco tiempo
  RETURN QUERY
  SELECT 
    'multiple_ip_access'::VARCHAR as alert_type,
    'Acceso desde múltiples IPs en poco tiempo'::TEXT as description,
    p.email::VARCHAR as user_email,
    NULL::INET as ip_address,
    'warning'::VARCHAR as severity,
    COUNT(DISTINCT us.ip_address) as event_count,
    MIN(us.created_at) as first_seen,
    MAX(us.created_at) as last_seen
  FROM user_sessions us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.created_at > NOW() - INTERVAL '1 hour'
    AND us.is_active = true
  GROUP BY p.email, us.user_id
  HAVING COUNT(DISTINCT us.ip_address) >= 3;
  
  -- Acceso a datos sensibles fuera de horario
  RETURN QUERY
  SELECT 
    'after_hours_access'::VARCHAR as alert_type,
    'Acceso a datos sensibles fuera de horario laboral'::TEXT as description,
    al.user_email::VARCHAR as user_email,
    al.ip_address,
    'info'::VARCHAR as severity,
    COUNT(*) as event_count,
    MIN(al.created_at) as first_seen,
    MAX(al.created_at) as last_seen
  FROM audit_logs al
  WHERE al.table_name IN ('cases', 'documents', 'notes')
    AND al.action = 'SELECT'
    AND al.created_at > NOW() - INTERVAL '24 hours'
    AND (EXTRACT(hour FROM al.created_at) < 8 OR EXTRACT(hour FROM al.created_at) > 20)
  GROUP BY al.user_email, al.ip_address
  HAVING COUNT(*) >= 10;
END;
$$ LANGUAGE plpgsql;

-- Función para auditar cambios automáticamente
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  user_info RECORD;
  changed_fields TEXT[] := '{}';
  field_name TEXT;
BEGIN
  -- Obtener información del usuario actual
  SELECT 
    p.id, p.role, p.email,
    current_setting('request.jwt.claims', true)::json->>'session_id' as session_id,
    current_setting('request.headers', true)::json->>'x-forwarded-for' as ip,
    current_setting('request.headers', true)::json->>'user-agent' as user_agent
  INTO user_info
  FROM profiles p 
  WHERE p.id = auth.uid();
  
  -- Determinar campos cambiados para UPDATE
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = TG_TABLE_NAME 
        AND table_schema = TG_TABLE_SCHEMA
    LOOP
      IF to_jsonb(OLD) ->> field_name IS DISTINCT FROM to_jsonb(NEW) ->> field_name THEN
        changed_fields := array_append(changed_fields, field_name);
      END IF;
    END LOOP;
  END IF;
  
  -- Insertar log de auditoría
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_fields,
    user_id,
    user_role,
    user_email,
    ip_address,
    user_agent,
    session_id,
    severity,
    category,
    description
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    changed_fields,
    user_info.id,
    user_info.role,
    user_info.email,
    user_info.ip::inet,
    user_info.user_agent,
    user_info.session_id,
    CASE 
      WHEN TG_TABLE_NAME IN ('cases', 'documents') THEN 'high'
      WHEN TG_TABLE_NAME IN ('profiles', 'magic_links') THEN 'warning'
      ELSE 'info'
    END,
    'data_change',
    format('%s %s en tabla %s', TG_OP, COALESCE(NEW.id::text, OLD.id::text), TG_TABLE_NAME)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de auditoría a tablas importantes
CREATE TRIGGER audit_cases_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cases
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_documents_trigger
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_case_notes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_case_stages_trigger
  AFTER INSERT OR UPDATE OR DELETE ON case_stages
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_magic_links_trigger
  AFTER INSERT OR UPDATE OR DELETE ON magic_links
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Habilitar RLS en todas las tablas de auditoría
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para audit_logs
CREATE POLICY "audit_logs_admin_access" ON audit_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin_firma'
    )
  );

CREATE POLICY "audit_logs_user_own_records" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- Políticas para user_sessions
CREATE POLICY "user_sessions_own_access" ON user_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "user_sessions_admin_access" ON user_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin_firma'
    )
  );

-- Políticas para login_attempts
CREATE POLICY "login_attempts_admin_access" ON login_attempts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin_firma'
    )
  );

-- Políticas para security_settings
CREATE POLICY "security_settings_admin_access" ON security_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin_firma'
    )
  );

-- Comentarios para documentación
COMMENT ON TABLE audit_logs IS 'Registro completo de auditoría para todas las operaciones del sistema';
COMMENT ON TABLE user_sessions IS 'Gestión de sesiones de usuario con información de dispositivo y ubicación';
COMMENT ON TABLE login_attempts IS 'Registro de todos los intentos de login exitosos y fallidos';
COMMENT ON TABLE security_settings IS 'Configuración de parámetros de seguridad del sistema';

COMMENT ON FUNCTION detect_suspicious_activity() IS 'Detecta patrones de actividad sospechosa en el sistema';
COMMENT ON FUNCTION cleanup_old_audit_logs() IS 'Limpia logs antiguos según la configuración de retención';
COMMENT ON FUNCTION audit_trigger_function() IS 'Función de trigger para auditoría automática de cambios';
