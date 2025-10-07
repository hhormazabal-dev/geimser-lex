-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin_firma', 'abogado', 'analista', 'cliente');
CREATE TYPE case_status AS ENUM ('activo', 'suspendido', 'archivado', 'terminado');
CREATE TYPE case_priority AS ENUM ('baja', 'media', 'alta', 'urgente');
CREATE TYPE stage_status AS ENUM ('pendiente', 'en_proceso', 'completado');
CREATE TYPE note_type AS ENUM ('privada', 'publica');
CREATE TYPE document_visibility AS ENUM ('privado', 'cliente');
CREATE TYPE request_type AS ENUM ('documento', 'informacion', 'reunion', 'otro');
CREATE TYPE request_status AS ENUM ('pendiente', 'en_revision', 'respondida', 'cerrada');
CREATE TYPE case_workflow_state AS ENUM ('preparacion', 'en_revision', 'activo', 'cerrado');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'cliente',
    nombre TEXT NOT NULL,
    rut TEXT UNIQUE,
    telefono TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cases table
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_causa TEXT,
    caratulado TEXT NOT NULL,
    materia TEXT,
    tribunal TEXT,
    region TEXT,
    comuna TEXT,
    rut_cliente TEXT,
    nombre_cliente TEXT NOT NULL,
    contraparte TEXT,
    etapa_actual TEXT DEFAULT 'Ingreso Demanda',
    estado case_status DEFAULT 'activo',
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    abogado_responsable UUID REFERENCES profiles(id),
    analista_id UUID REFERENCES profiles(id),
    workflow_state case_workflow_state DEFAULT 'preparacion',
    validado_at TIMESTAMPTZ,
    prioridad case_priority DEFAULT 'media',
    valor_estimado NUMERIC(15,2),
    observaciones TEXT,
    descripcion_inicial TEXT,
    objetivo_cliente TEXT,
    documentacion_recibida TEXT,
    cliente_principal_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case stages table (timeline procesal)
CREATE TABLE case_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    etapa TEXT NOT NULL,
    descripcion TEXT,
    estado stage_status DEFAULT 'pendiente',
    fecha_programada DATE,
    fecha_cumplida DATE,
    responsable_id UUID REFERENCES profiles(id),
    es_publica BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES profiles(id) NOT NULL,
    tipo note_type NOT NULL DEFAULT 'privada',
    contenido TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    uploader_id UUID REFERENCES profiles(id) NOT NULL,
    nombre TEXT NOT NULL,
    tipo_mime TEXT,
    size_bytes BIGINT,
    url TEXT NOT NULL,
    visibilidad document_visibility DEFAULT 'privado',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Information requests table
CREATE TABLE info_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    creador_id UUID REFERENCES profiles(id) NOT NULL,
    titulo TEXT NOT NULL,
    tipo request_type DEFAULT 'informacion',
    descripcion TEXT NOT NULL,
    prioridad case_priority DEFAULT 'media',
    fecha_limite DATE,
    es_publica BOOLEAN DEFAULT true,
    estado request_status DEFAULT 'pendiente',
    respuesta TEXT,
    documento_respuesta_id UUID REFERENCES documents(id),
    archivo_adjunto TEXT,
    respondido_por UUID REFERENCES profiles(id),
    respondido_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case clients mapping (for portal access)
CREATE TABLE case_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    client_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(case_id, client_profile_id)
);

-- Case collaborators (for multi-lawyer cases)
CREATE TABLE case_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    abogado_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(case_id, abogado_id)
);

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    diff_json JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portal tokens table (for magic links)
CREATE TABLE portal_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    client_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Magic links table (self-service portal access)
CREATE TABLE magic_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    client_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    permissions TEXT[] DEFAULT ARRAY['view_case'],
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    single_use BOOLEAN DEFAULT TRUE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_cases_abogado_responsable ON cases(abogado_responsable);
CREATE INDEX idx_cases_estado ON cases(estado);
CREATE INDEX idx_cases_fecha_inicio ON cases(fecha_inicio);
CREATE INDEX idx_case_stages_case_id ON case_stages(case_id);
CREATE INDEX idx_case_stages_estado ON case_stages(estado);
CREATE INDEX idx_case_stages_orden ON case_stages(case_id, orden);
CREATE INDEX idx_notes_case_id ON notes(case_id);
CREATE INDEX idx_notes_tipo ON notes(tipo);
CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_documents_visibilidad ON documents(visibilidad);
CREATE INDEX idx_info_requests_case_id ON info_requests(case_id);
CREATE INDEX idx_info_requests_estado ON info_requests(estado);
CREATE INDEX idx_case_clients_case_id ON case_clients(case_id);
CREATE INDEX idx_case_clients_client_profile_id ON case_clients(client_profile_id);
CREATE INDEX idx_case_collaborators_case_id ON case_collaborators(case_id);
CREATE INDEX idx_case_collaborators_abogado_id ON case_collaborators(abogado_id);
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_portal_tokens_token ON portal_tokens(token);
CREATE INDEX idx_portal_tokens_case_id ON portal_tokens(case_id);
CREATE INDEX idx_magic_links_case_id ON magic_links(case_id);
CREATE INDEX idx_magic_links_email ON magic_links(email);
CREATE INDEX idx_magic_links_token ON magic_links(token);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_case_stages_updated_at BEFORE UPDATE ON case_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_info_requests_updated_at BEFORE UPDATE ON info_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_magic_links_updated_at BEFORE UPDATE ON magic_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
