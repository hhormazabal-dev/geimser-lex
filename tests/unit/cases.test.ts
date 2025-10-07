import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCase, updateCase, deleteCase, getCases, getCaseById } from '@/lib/actions/cases';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { CreateCaseInput, UpdateCaseInput } from '@/lib/validators/case';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

// Mock auth functions
vi.mock('@/lib/auth/roles', () => ({
  requireAuth: vi.fn(),
  getCurrentProfile: vi.fn(),
}));

// Mock audit logging
vi.mock('@/lib/audit/log', () => ({
  logAuditAction: vi.fn(),
}));

// Mock notifications
vi.mock('@/lib/notifications/hooks', () => ({
  onCaseCreated: vi.fn(),
}));

describe('Cases Server Actions', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  };

  const mockProfile = {
    id: 'user-123',
    role: 'abogado',
    nombre: 'Test Lawyer',
    email: 'lawyer@test.com',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabaseClient);
    (createServiceClient as any).mockReturnValue(mockSupabaseClient);
    
    // Mock requireAuth to return test profile
    const rolesModule = await import('@/lib/auth/roles');
    vi.mocked(rolesModule.requireAuth).mockResolvedValue(mockProfile as any);
    vi.mocked(rolesModule.getCurrentProfile).mockResolvedValue(mockProfile as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCase', () => {
    it('should create a case successfully', async () => {
      const mockCaseData: CreateCaseInput = {
        caratulado: 'Test Case vs Test Defendant',
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        tribunal: 'Juzgado Civil de Santiago',
        nombre_cliente: 'Juan Pérez',
        fecha_inicio: '2024-01-15',
        prioridad: 'media',
        estado: 'activo',
        valor_estimado: 1000000,
        observaciones: 'Caso de prueba',
        descripcion_inicial: 'Los hechos relevantes del caso se describen en este resumen inicial.',
      };

      const mockInsertResponse = {
        data: [{ id: 'case-123', ...mockCaseData, workflow_state: 'preparacion' }],
        error: null,
      };

      const mockCasesQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockInsertResponse),
      };

      const mockStagesQuery = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'cases') {
          return mockCasesQuery;
        }

        if (table === 'case_stages') {
          return mockStagesQuery;
        }

        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const result = await createCase(mockCaseData);

      expect(result.success).toBe(true);
      expect(result.case).toEqual(mockInsertResponse.data[0]);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('cases');
      expect(mockCasesQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        caratulado: mockCaseData.caratulado,
        workflow_state: 'preparacion',
      }));
      expect(mockStagesQuery.insert).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const invalidCaseData = {
        caratulado: '', // Required field empty
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        descripcion_inicial: '',
      } as CreateCaseInput;

      const result = await createCase(invalidCaseData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('caratulado');
    });

    it('should handle database errors', async () => {
      const mockCaseData: CreateCaseInput = {
        caratulado: 'Test Case',
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        tribunal: 'Test Court',
        nombre_cliente: 'Test Client',
        fecha_inicio: '2024-01-15',
        prioridad: 'media',
        estado: 'activo',
        descripcion_inicial: 'Resumen detallado del caso para evaluar la estrategia.',
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await createCase(mockCaseData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should validate Chilean RUT format', async () => {
      const mockCaseData: CreateCaseInput = {
        caratulado: 'Test Case',
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        tribunal: 'Test Court',
        nombre_cliente: 'Test Client',
        rut_cliente: 'invalid-rut', // Invalid RUT format
        fecha_inicio: '2024-01-15',
        prioridad: 'media',
        estado: 'activo',
        descripcion_inicial: 'Resumen detallado del caso para evaluar la estrategia.',
      };

      const result = await createCase(mockCaseData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('RUT');
    });
  });

  describe('updateCase', () => {
    it('should update a case successfully', async () => {
      const caseId = 'case-123';
      const updateData: UpdateCaseInput = {
        caratulado: 'Updated Case Name',
        estado: 'suspendido',
        observaciones: 'Updated observations',
      };

      const existingCase = {
        id: caseId,
        abogado_responsable: mockProfile.id,
        analista_id: null,
        workflow_state: 'preparacion',
      };

      const mockUpdateResponse = {
        data: [{ id: caseId, ...updateData }],
        error: null,
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingCase, error: null }),
      };

      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockUpdateResponse),
      };

      let casesCallCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'cases') {
          casesCallCount += 1;
          return casesCallCount === 1 ? selectQuery : updateQuery;
        }

        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const result = await updateCase(caseId, updateData);

      expect(result.success).toBe(true);
      expect(result.case).toEqual(mockUpdateResponse.data[0]);
      expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining(updateData));
      expect(updateQuery.eq).toHaveBeenCalledWith('id', caseId);
    });

    it('should handle non-existent case', async () => {
      const caseId = 'non-existent';
      const updateData: UpdateCaseInput = {
        caratulado: 'Updated Case Name',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'No rows found' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'cases') {
          return mockQuery;
        }
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const result = await updateCase(caseId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No rows found');
    });
  });

  describe('getCases', () => {
    it('should retrieve cases with filters', async () => {
      const mockCases = [
        {
          id: 'case-1',
          caratulado: 'Case 1',
          estado: 'activo',
          materia: 'Civil',
        },
        {
          id: 'case-2',
          caratulado: 'Case 2',
          estado: 'terminado',
          materia: 'Laboral',
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockCases,
          error: null,
          count: 2,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await getCases({
        estado: 'activo',
        search: 'Case',
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.cases).toEqual(mockCases);
      expect(result.total).toBe(2);
      expect(mockQuery.eq).toHaveBeenCalledWith('estado', 'activo');
    });

    it('should handle search functionality', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await getCases({ search: 'test search' });

      expect(mockQuery.or).toHaveBeenCalledWith(
        'caratulado.ilike.%test search%,numero_causa.ilike.%test search%,nombre_cliente.ilike.%test search%'
      );
    });
  });

  describe('getCaseById', () => {
    it('should retrieve a specific case', async () => {
      const caseId = 'case-123';
      const mockCase = {
        id: caseId,
        caratulado: 'Test Case',
        estado: 'activo',
        abogado_responsable: {
          id: 'lawyer-1',
          nombre: 'Test Lawyer',
        },
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockCase,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await getCaseById(caseId);

      expect(result.success).toBe(true);
      expect(result.case).toEqual(mockCase);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', caseId);
    });

    it('should handle case not found', async () => {
      const caseId = 'non-existent';

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'No rows found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await getCaseById(caseId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No rows found');
    });
  });

  describe('deleteCase', () => {
    it('should delete a case successfully', async () => {
      const caseId = 'case-123';

      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await deleteCase(caseId);

      expect(result.success).toBe(true);
      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', caseId);
    });

    it('should handle deletion errors', async () => {
      const caseId = 'case-123';

      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Cannot delete case with dependencies' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await deleteCase(caseId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete case with dependencies');
    });

    it('should only allow admin or case owner to delete', async () => {
      // Mock a different user profile (not admin, not case owner)
      const { requireAuth } = require('@/lib/auth/roles');
      requireAuth.mockResolvedValue({
        id: 'other-user',
        role: 'abogado',
        nombre: 'Other Lawyer',
      });

      const caseId = 'case-123';

      // Mock case owned by different user
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { abogado_responsable: 'original-owner' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockSelectQuery);

      const result = await deleteCase(caseId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('permisos');
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin to access all cases', async () => {
      const { requireAuth } = require('@/lib/auth/roles');
      requireAuth.mockResolvedValue({
        id: 'admin-user',
        role: 'admin_firma',
        nombre: 'Admin User',
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await getCases({});

      // Admin should not have abogado_responsable filter
      expect(mockQuery.eq).not.toHaveBeenCalledWith('abogado_responsable', 'admin-user');
    });

    it('should restrict abogado to their own cases', async () => {
      const { requireAuth } = require('@/lib/auth/roles');
      requireAuth.mockResolvedValue({
        id: 'lawyer-user',
        role: 'abogado',
        nombre: 'Lawyer User',
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await getCases({});

      // Lawyer should only see their own cases
      expect(mockQuery.eq).toHaveBeenCalledWith('abogado_responsable', 'lawyer-user');
    });

    it('should deny access to cliente role', async () => {
      const { requireAuth } = require('@/lib/auth/roles');
      requireAuth.mockResolvedValue({
        id: 'client-user',
        role: 'cliente',
        nombre: 'Client User',
      });

      const result = await getCases({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('permisos');
    });
  });
});
