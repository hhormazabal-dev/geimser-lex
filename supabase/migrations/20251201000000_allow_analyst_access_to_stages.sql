BEGIN;

CREATE OR REPLACE FUNCTION has_case_access(case_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_profile profiles;
BEGIN
    SELECT * INTO current_profile FROM get_current_profile();

    IF current_profile.id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admins always have access
    IF current_profile.role = 'admin_firma' THEN
        RETURN TRUE;
    END IF;

    -- Analysts can access cases where they are assigned
    IF current_profile.role = 'analista' THEN
        RETURN EXISTS (
            SELECT 1
            FROM cases
            WHERE id = case_uuid
              AND analista_id = current_profile.id
        );
    END IF;

    -- Lawyers can access cases where they are responsible or collaborators
    IF current_profile.role = 'abogado' THEN
        RETURN EXISTS (
            SELECT 1
            FROM cases
            WHERE id = case_uuid
              AND (
                    abogado_responsable = current_profile.id
                 OR EXISTS (
                        SELECT 1
                        FROM case_collaborators
                        WHERE case_id = case_uuid
                          AND abogado_id = current_profile.id
                    )
              )
        );
    END IF;

    -- Clients can access cases where they are assigned
    IF current_profile.role = 'cliente' THEN
        RETURN EXISTS (
            SELECT 1
            FROM case_clients
            WHERE case_id = case_uuid
              AND client_profile_id = current_profile.id
        );
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
