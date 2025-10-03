-- Crear tabla para logs de notificaciones
CREATE TABLE notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'push')),
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  template VARCHAR(100) NOT NULL,
  data JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para optimizar consultas
CREATE INDEX idx_notification_logs_type ON notification_logs(type);
CREATE INDEX idx_notification_logs_recipient ON notification_logs(recipient);
CREATE INDEX idx_notification_logs_template ON notification_logs(template);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);

-- Crear índice compuesto para búsquedas de duplicados
CREATE INDEX idx_notification_logs_dedup ON notification_logs(template, recipient, (data->>'stage_id'), sent_at);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_notification_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER trigger_update_notification_logs_updated_at
  BEFORE UPDATE ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_logs_updated_at();

-- Habilitar RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Política para que solo admin y service role puedan acceder
CREATE POLICY "notification_logs_admin_access" ON notification_logs
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin_firma'
    )
  );

-- Comentarios para documentación
COMMENT ON TABLE notification_logs IS 'Registro de todas las notificaciones enviadas por el sistema';
COMMENT ON COLUMN notification_logs.type IS 'Tipo de notificación: email, sms, push';
COMMENT ON COLUMN notification_logs.recipient IS 'Destinatario de la notificación (email, teléfono, etc.)';
COMMENT ON COLUMN notification_logs.subject IS 'Asunto del mensaje (para emails)';
COMMENT ON COLUMN notification_logs.template IS 'Plantilla utilizada para generar el mensaje';
COMMENT ON COLUMN notification_logs.data IS 'Datos utilizados para generar el mensaje desde la plantilla';
COMMENT ON COLUMN notification_logs.status IS 'Estado de la notificación';
COMMENT ON COLUMN notification_logs.error_message IS 'Mensaje de error si la notificación falló';
COMMENT ON COLUMN notification_logs.sent_at IS 'Fecha y hora cuando se envió la notificación';
