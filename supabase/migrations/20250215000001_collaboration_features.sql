-- Messaging between abogados y clientes
CREATE TABLE case_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    audience TEXT CHECK (audience IN ('abogado','cliente','equipo')) DEFAULT 'equipo',
    contenido TEXT NOT NULL,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_messages_case_id ON case_messages(case_id);
CREATE INDEX idx_case_messages_sender ON case_messages(sender_profile_id);

ALTER TABLE case_messages ENABLE ROW LEVEL SECURITY;

-- Messaging RLS
CREATE POLICY "Participants read case messages" ON case_messages
    FOR SELECT USING (
        has_case_access(case_id)
    );

CREATE POLICY "Abogados y admin envían mensajes" ON case_messages
    FOR INSERT WITH CHECK (
        sender_profile_id = (SELECT id FROM get_current_profile())
        AND (SELECT role FROM profiles WHERE id = sender_profile_id) IN ('abogado','admin_firma')
        AND has_case_access(case_id)
    );

CREATE POLICY "Clientes responden sus casos" ON case_messages
    FOR INSERT WITH CHECK (
        sender_profile_id = (SELECT id FROM get_current_profile())
        AND (SELECT role FROM profiles WHERE id = sender_profile_id) = 'cliente'
        AND EXISTS (
            SELECT 1 FROM case_clients
            WHERE case_id = case_messages.case_id
              AND client_profile_id = sender_profile_id
        )
    );

CREATE POLICY "Solo autor modifica o elimina" ON case_messages
    FOR UPDATE USING (sender_profile_id = (SELECT id FROM get_current_profile()))
    WITH CHECK (sender_profile_id = (SELECT id FROM get_current_profile()));

CREATE POLICY "Solo autor elimina" ON case_messages
    FOR DELETE USING (sender_profile_id = (SELECT id FROM get_current_profile()));

-- Plantillas legales reutilizables
CREATE TABLE legal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT,
    content TEXT NOT NULL,
    is_shared BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE legal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates visibles por abogados y admin" ON legal_templates
    FOR SELECT USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('abogado','admin_firma')
    );

CREATE POLICY "Solo admin crea plantillas compartidas" ON legal_templates
    FOR INSERT WITH CHECK (
        (SELECT role FROM profiles WHERE id = created_by) = 'admin_firma'
        OR is_shared = false
    );

CREATE POLICY "Autor o admin actualiza" ON legal_templates
    FOR UPDATE USING (
        created_by = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_firma'
    )
    WITH CHECK (
        created_by = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_firma'
    );

CREATE POLICY "Autor o admin elimina" ON legal_templates
    FOR DELETE USING (
        created_by = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_firma'
    );

-- Enlaces rápidos a portales clave
CREATE TABLE quick_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT,
    icon TEXT,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quick_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Abogados y admin ven enlaces" ON quick_links
    FOR SELECT USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('abogado','admin_firma')
    );

CREATE POLICY "Abogados y admin crean enlaces" ON quick_links
    FOR INSERT WITH CHECK (
        (SELECT role FROM profiles WHERE id = created_by) IN ('abogado','admin_firma')
    );

CREATE POLICY "Autor o admin gestiona" ON quick_links
    FOR UPDATE USING (
        created_by = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_firma'
    )
    WITH CHECK (
        created_by = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_firma'
    );

CREATE POLICY "Autor o admin elimina" ON quick_links
    FOR DELETE USING (
        created_by = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_firma'
    );

-- Seed básicos
INSERT INTO quick_links (title, url, category, icon, is_default)
VALUES
  ('Poder Judicial - Consulta Unificada', 'https://corte.pjud.cl/', 'Portales', 'gavel', true),
  ('Oficina Judicial Virtual', 'https://oficinajudicialvirtual.pjud.cl', 'Portales', 'scale', true),
  ('Diario Oficial', 'https://www.diariooficial.cl', 'Referencias', 'newspaper', true)
ON CONFLICT DO NOTHING;

INSERT INTO legal_templates (title, category, content, is_shared)
VALUES
  ('Carta Solicitud Documentación', 'Comunicaciones', 'Estimado cliente, necesitamos los siguientes documentos...', true),
  ('Acta de Reunión Interna', 'Interno', 'Participantes, acuerdos, próximos pasos...', true)
ON CONFLICT DO NOTHING;
