-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE info_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's profile
CREATE OR REPLACE FUNCTION get_current_profile()
RETURNS profiles AS $$
DECLARE
    profile_record profiles;
BEGIN
    SELECT * INTO profile_record
    FROM profiles
    WHERE user_id = auth.uid();
    
    RETURN profile_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'admin_firma'
        FROM profiles
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is abogado
CREATE OR REPLACE FUNCTION is_abogado()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'abogado'
        FROM profiles
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is cliente
CREATE OR REPLACE FUNCTION is_cliente()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'cliente'
        FROM profiles
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has access to case
CREATE OR REPLACE FUNCTION has_case_access(case_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_profile profiles;
BEGIN
    SELECT * INTO current_profile FROM get_current_profile();
    
    -- Admin has access to all cases
    IF current_profile.role = 'admin_firma' THEN
        RETURN TRUE;
    END IF;
    
    -- Abogado has access if they are responsible or collaborator
    IF current_profile.role = 'abogado' THEN
        RETURN EXISTS (
            SELECT 1 FROM cases 
            WHERE id = case_uuid 
            AND abogado_responsable = current_profile.id
        ) OR EXISTS (
            SELECT 1 FROM case_collaborators 
            WHERE case_id = case_uuid 
            AND abogado_id = current_profile.id
        );
    END IF;
    
    -- Cliente has access if they are assigned to the case
    IF current_profile.role = 'cliente' THEN
        RETURN EXISTS (
            SELECT 1 FROM case_clients 
            WHERE case_id = case_uuid 
            AND client_profile_id = current_profile.id
        );
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for profiles table
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (is_admin());

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (is_admin());

-- RLS Policies for cases table
CREATE POLICY "Admins can view all cases" ON cases
    FOR SELECT USING (is_admin());

CREATE POLICY "Abogados y analistas pueden ver casos asignados" ON cases
    FOR SELECT USING (
        (
            is_abogado() AND (
                abogado_responsable = (SELECT id FROM get_current_profile()) OR
                EXISTS (
                    SELECT 1 FROM case_collaborators 
                    WHERE case_id = cases.id 
                    AND abogado_id = (SELECT id FROM get_current_profile())
                )
            )
        ) OR (
            (SELECT role FROM get_current_profile()) = 'analista' AND analista_id = (SELECT id FROM get_current_profile())
        )
    );

CREATE POLICY "Clientes can view their cases" ON cases
    FOR SELECT USING (
        is_cliente() AND EXISTS (
            SELECT 1 FROM case_clients 
            WHERE case_id = cases.id 
            AND client_profile_id = (SELECT id FROM get_current_profile())
        )
    );

CREATE POLICY "Admins and abogados can insert cases" ON cases
    FOR INSERT WITH CHECK (is_admin() OR is_abogado());

CREATE POLICY "Admins can update all cases" ON cases
    FOR UPDATE USING (is_admin());

CREATE POLICY "Abogados can update their assigned cases" ON cases
    FOR UPDATE USING (
        is_abogado() AND (
            abogado_responsable = (SELECT id FROM get_current_profile()) OR
            EXISTS (
                SELECT 1 FROM case_collaborators 
                WHERE case_id = cases.id 
                AND abogado_id = (SELECT id FROM get_current_profile())
            )
        )
    );

-- RLS Policies for case_stages table
CREATE POLICY "Users can view stages of accessible cases" ON case_stages
    FOR SELECT USING (has_case_access(case_id));

CREATE POLICY "Clientes can only view public stages" ON case_stages
    FOR SELECT USING (
        is_cliente() AND es_publica = true AND has_case_access(case_id)
    );

CREATE POLICY "Admins and abogados can insert stages" ON case_stages
    FOR INSERT WITH CHECK (
        (is_admin() OR is_abogado()) AND has_case_access(case_id)
    );

CREATE POLICY "Admins and abogados can update stages" ON case_stages
    FOR UPDATE USING (
        (is_admin() OR is_abogado()) AND has_case_access(case_id)
    );

-- RLS Policies for notes table
CREATE POLICY "Users can view notes of accessible cases" ON notes
    FOR SELECT USING (has_case_access(case_id));

CREATE POLICY "Clientes can only view public notes" ON notes
    FOR SELECT USING (
        is_cliente() AND tipo = 'publica' AND has_case_access(case_id)
    );

CREATE POLICY "Admins and abogados can insert notes" ON notes
    FOR INSERT WITH CHECK (
        (is_admin() OR is_abogado()) AND has_case_access(case_id)
    );

CREATE POLICY "Authors can update their own notes" ON notes
    FOR UPDATE USING (
        author_id = (SELECT id FROM get_current_profile()) AND has_case_access(case_id)
    );

-- RLS Policies for documents table
CREATE POLICY "Users can view documents of accessible cases" ON documents
    FOR SELECT USING (has_case_access(case_id));

CREATE POLICY "Clientes can only view client-visible documents" ON documents
    FOR SELECT USING (
        is_cliente() AND visibilidad = 'cliente' AND has_case_access(case_id)
    );

CREATE POLICY "Users can insert documents to accessible cases" ON documents
    FOR INSERT WITH CHECK (has_case_access(case_id));

CREATE POLICY "Uploaders can update their own documents" ON documents
    FOR UPDATE USING (
        uploader_id = (SELECT id FROM get_current_profile()) AND has_case_access(case_id)
    );

CREATE POLICY "Admins and abogados can update all documents" ON documents
    FOR UPDATE USING (
        (is_admin() OR is_abogado()) AND has_case_access(case_id)
    );

-- RLS Policies for info_requests table
CREATE POLICY "Users can view requests of accessible cases" ON info_requests
    FOR SELECT USING (has_case_access(case_id));

CREATE POLICY "Admins and abogados can insert requests" ON info_requests
    FOR INSERT WITH CHECK (
        (is_admin() OR is_abogado()) AND has_case_access(case_id)
    );

CREATE POLICY "Creators can update their own requests" ON info_requests
    FOR UPDATE USING (
        creador_id = (SELECT id FROM get_current_profile()) AND has_case_access(case_id)
    );

CREATE POLICY "Clientes can update requests for their cases" ON info_requests
    FOR UPDATE USING (
        is_cliente() AND has_case_access(case_id)
    );

-- RLS Policies for case_clients table
CREATE POLICY "Admins can view all case-client mappings" ON case_clients
    FOR SELECT USING (is_admin());

CREATE POLICY "Abogados can view mappings for their cases" ON case_clients
    FOR SELECT USING (
        is_abogado() AND has_case_access(case_id)
    );

CREATE POLICY "Clientes can view their own mappings" ON case_clients
    FOR SELECT USING (
        is_cliente() AND client_profile_id = (SELECT id FROM get_current_profile())
    );

CREATE POLICY "Admins and abogados can insert case-client mappings" ON case_clients
    FOR INSERT WITH CHECK (
        (is_admin() OR is_abogado()) AND has_case_access(case_id)
    );

-- RLS Policies for case_collaborators table
CREATE POLICY "Users can view collaborators of accessible cases" ON case_collaborators
    FOR SELECT USING (has_case_access(case_id));

CREATE POLICY "Admins can insert collaborators" ON case_collaborators
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update collaborators" ON case_collaborators
    FOR UPDATE USING (is_admin());

-- RLS Policies for audit_log table
CREATE POLICY "Only admins can view audit logs" ON audit_log
    FOR SELECT USING (is_admin());

CREATE POLICY "All authenticated users can insert audit logs" ON audit_log
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for portal_tokens table
CREATE POLICY "Only admins and abogados can view portal tokens" ON portal_tokens
    FOR SELECT USING (is_admin() OR is_abogado());

CREATE POLICY "Only admins and abogados can insert portal tokens" ON portal_tokens
    FOR INSERT WITH CHECK (
        (is_admin() OR is_abogado()) AND has_case_access(case_id)
    );

CREATE POLICY "Only admins and abogados can update portal tokens" ON portal_tokens
    FOR UPDATE USING (
        (is_admin() OR is_abogado()) AND has_case_access(case_id)
    );
