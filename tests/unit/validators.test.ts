import { describe, it, expect } from 'vitest';
import { 
  createCaseSchema, 
  updateCaseSchema,
  validateRUT,
  MATERIAS_LEGALES,
  ESTADOS_CASO,
  PRIORIDADES_CASO 
} from '@/lib/validators/case';
import { 
  createNoteSchema,
  updateNoteSchema 
} from '@/lib/validators/notes';
import { 
  createDocumentSchema,
  updateDocumentSchema 
} from '@/lib/validators/documents';
import { 
  createStageSchema,
  updateStageSchema,
  ETAPAS_POR_MATERIA 
} from '@/lib/validators/stages';
import { 
  createInfoRequestSchema,
  updateInfoRequestSchema,
  TIPOS_SOLICITUD,
  PRIORIDADES_SOLICITUD 
} from '@/lib/validators/info-requests';
import { 
  generateMagicLinkSchema,
  MAGIC_LINK_PERMISSIONS 
} from '@/lib/validators/magic-links';

describe('Case Validators', () => {
  describe('createCaseSchema', () => {
    it('should validate a complete valid case', () => {
      const validCase = {
        caratulado: 'Pérez vs González',
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        tribunal: 'Juzgado Civil de Santiago',
        nombre_cliente: 'Juan Pérez',
        rut_cliente: '12345678-9',
        fecha_inicio: '2024-01-15',
        prioridad: 'media',
        estado: 'activo',
        valor_estimado: 1000000,
        observaciones: 'Caso de demanda civil',
        contraparte: 'María González',
      };

      const result = createCaseSchema.safeParse(validCase);
      expect(result.success).toBe(true);
    });

    it('should require mandatory fields', () => {
      const incompleteCase = {
        numero_causa: 'C-2024-001',
        materia: 'Civil',
      };

      const result = createCaseSchema.safeParse(incompleteCase);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.issues.map(issue => issue.path[0]);
        expect(errors).toContain('caratulado');
        expect(errors).toContain('tribunal');
        expect(errors).toContain('nombre_cliente');
        expect(errors).toContain('rut_cliente');
        expect(errors).toContain('fecha_inicio');
      }
    });

    it('should validate materia legal values', () => {
      const invalidMateria = {
        caratulado: 'Test Case',
        numero_causa: 'C-2024-001',
        materia: 'InvalidMateria',
        tribunal: 'Test Court',
        nombre_cliente: 'Test Client',
        rut_cliente: '12345678-9',
        fecha_inicio: '2024-01-15',
      };

      const result = createCaseSchema.safeParse(invalidMateria);
      expect(result.success).toBe(false);
    });

    it('should validate estado values', () => {
      const invalidEstado = {
        caratulado: 'Test Case',
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        tribunal: 'Test Court',
        nombre_cliente: 'Test Client',
        rut_cliente: '12345678-9',
        fecha_inicio: '2024-01-15',
        estado: 'invalid_estado',
      };

      const result = createCaseSchema.safeParse(invalidEstado);
      expect(result.success).toBe(false);
    });

    it('should validate prioridad values', () => {
      const invalidPrioridad = {
        caratulado: 'Test Case',
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        tribunal: 'Test Court',
        nombre_cliente: 'Test Client',
        rut_cliente: '12345678-9',
        fecha_inicio: '2024-01-15',
        prioridad: 'invalid_priority',
      };

      const result = createCaseSchema.safeParse(invalidPrioridad);
      expect(result.success).toBe(false);
    });

    it('should validate positive valor_estimado', () => {
      const negativeValue = {
        caratulado: 'Test Case',
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        tribunal: 'Test Court',
        nombre_cliente: 'Test Client',
        rut_cliente: '12345678-9',
        fecha_inicio: '2024-01-15',
        valor_estimado: -1000,
      };

      const result = createCaseSchema.safeParse(negativeValue);
      expect(result.success).toBe(false);
    });

    it('should validate date format', () => {
      const invalidDate = {
        caratulado: 'Test Case',
        numero_causa: 'C-2024-001',
        materia: 'Civil',
        tribunal: 'Test Court',
        nombre_cliente: 'Test Client',
        rut_cliente: '12345678-9',
        fecha_inicio: 'invalid-date',
      };

      const result = createCaseSchema.safeParse(invalidDate);
      expect(result.success).toBe(false);
    });
  });

  describe('updateCaseSchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        estado: 'suspendido',
        observaciones: 'Updated observations',
      };

      const result = updateCaseSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate updated fields', () => {
      const invalidUpdate = {
        estado: 'invalid_estado',
        valor_estimado: -500,
      };

      const result = updateCaseSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });

  describe('RUT validation', () => {
    it('should validate correct RUT formats', () => {
      const validRUTs = [
        '12345678-9',
        '1234567-8',
        '12.345.678-9',
        '1.234.567-8',
      ];

      validRUTs.forEach(rut => {
        expect(validateRUT(rut)).toBe(true);
      });
    });

    it('should reject invalid RUT formats', () => {
      const invalidRUTs = [
        '123456789', // No dash
        '12345678-', // No check digit
        '-9', // No number
        '12345678-10', // Invalid check digit length
        'abcd-1', // Non-numeric
        '123.456.78-9', // Wrong dot placement
      ];

      invalidRUTs.forEach(rut => {
        expect(validateRUT(rut)).toBe(false);
      });
    });

    it('should validate RUT check digit algorithm', () => {
      // These are real valid Chilean RUTs for testing
      const validRUTs = [
        '11111111-1',
        '22222222-2',
        '12345678-5',
      ];

      validRUTs.forEach(rut => {
        expect(validateRUT(rut)).toBe(true);
      });
    });
  });
});

describe('Notes Validators', () => {
  describe('createNoteSchema', () => {
    it('should validate a complete note', () => {
      const validNote = {
        case_id: 'case-123',
        titulo: 'Important Note',
        contenido: 'This is the note content',
        es_privada: false,
        categoria: 'general',
      };

      const result = createNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should require mandatory fields', () => {
      const incompleteNote = {
        titulo: 'Note Title',
      };

      const result = createNoteSchema.safeParse(incompleteNote);
      expect(result.success).toBe(false);
    });

    it('should validate minimum content length', () => {
      const shortNote = {
        case_id: 'case-123',
        titulo: 'Short Note',
        contenido: 'x', // Too short
        es_privada: false,
      };

      const result = createNoteSchema.safeParse(shortNote);
      expect(result.success).toBe(false);
    });
  });
});

describe('Documents Validators', () => {
  describe('createDocumentSchema', () => {
    it('should validate a complete document', () => {
      const validDocument = {
        case_id: 'case-123',
        nombre: 'Contract.pdf',
        descripcion: 'Main contract document',
        tipo_documento: 'contrato',
        visible_cliente: true,
        archivo_url: 'https://example.com/file.pdf',
        archivo_size: 1024000,
        archivo_type: 'application/pdf',
      };

      const result = createDocumentSchema.safeParse(validDocument);
      expect(result.success).toBe(true);
    });

    it('should validate file size limits', () => {
      const largeDocument = {
        case_id: 'case-123',
        nombre: 'Large.pdf',
        descripcion: 'Large document',
        archivo_url: 'https://example.com/file.pdf',
        archivo_size: 100 * 1024 * 1024, // 100MB - too large
        archivo_type: 'application/pdf',
      };

      const result = createDocumentSchema.safeParse(largeDocument);
      expect(result.success).toBe(false);
    });

    it('should validate allowed file types', () => {
      const invalidFileType = {
        case_id: 'case-123',
        nombre: 'Script.exe',
        descripcion: 'Executable file',
        archivo_url: 'https://example.com/file.exe',
        archivo_size: 1024,
        archivo_type: 'application/x-executable', // Not allowed
      };

      const result = createDocumentSchema.safeParse(invalidFileType);
      expect(result.success).toBe(false);
    });
  });
});

describe('Stages Validators', () => {
  describe('createStageSchema', () => {
    it('should validate a complete stage', () => {
      const validStage = {
        case_id: 'case-123',
        etapa: 'Demanda',
        descripcion: 'Presentación de demanda',
        fecha_programada: '2024-02-15T10:00:00Z',
        es_publica: true,
        orden: 1,
      };

      const result = createStageSchema.safeParse(validStage);
      expect(result.success).toBe(true);
    });

    it('should validate future dates for programmed stages', () => {
      const pastStage = {
        case_id: 'case-123',
        etapa: 'Demanda',
        descripcion: 'Past stage',
        fecha_programada: '2020-01-01T10:00:00Z', // Past date
        es_publica: true,
        orden: 1,
      };

      const result = createStageSchema.safeParse(pastStage);
      expect(result.success).toBe(false);
    });

    it('should validate positive order numbers', () => {
      const negativeOrder = {
        case_id: 'case-123',
        etapa: 'Demanda',
        descripcion: 'Stage with negative order',
        fecha_programada: '2024-02-15T10:00:00Z',
        es_publica: true,
        orden: -1, // Invalid
      };

      const result = createStageSchema.safeParse(negativeOrder);
      expect(result.success).toBe(false);
    });
  });

  describe('ETAPAS_POR_MATERIA', () => {
    it('should have stages defined for all legal matters', () => {
      const materias = ['Civil', 'Penal', 'Laboral', 'Familia', 'Comercial'];
      
      materias.forEach(materia => {
        expect(ETAPAS_POR_MATERIA[materia]).toBeDefined();
        expect(ETAPAS_POR_MATERIA[materia].length).toBeGreaterThan(0);
      });
    });

    it('should have valid stage structures', () => {
      Object.values(ETAPAS_POR_MATERIA).forEach(etapas => {
        etapas.forEach(etapa => {
          expect(etapa).toHaveProperty('nombre');
          expect(etapa).toHaveProperty('descripcion');
          expect(etapa).toHaveProperty('orden');
          expect(typeof etapa.nombre).toBe('string');
          expect(typeof etapa.descripcion).toBe('string');
          expect(typeof etapa.orden).toBe('number');
        });
      });
    });
  });
});

describe('Info Requests Validators', () => {
  describe('createInfoRequestSchema', () => {
    it('should validate a complete info request', () => {
      const validRequest = {
        case_id: 'case-123',
        titulo: 'Document Request',
        descripcion: 'Please provide the contract copy',
        tipo: 'documento',
        prioridad: 'media',
        fecha_limite: '2024-02-15T23:59:59Z',
        es_privada: false,
      };

      const result = createInfoRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate request types', () => {
      const invalidType = {
        case_id: 'case-123',
        titulo: 'Invalid Request',
        descripcion: 'Request with invalid type',
        tipo: 'invalid_type',
        prioridad: 'media',
      };

      const result = createInfoRequestSchema.safeParse(invalidType);
      expect(result.success).toBe(false);
    });

    it('should validate priority levels', () => {
      const invalidPriority = {
        case_id: 'case-123',
        titulo: 'Request',
        descripcion: 'Request with invalid priority',
        tipo: 'documento',
        prioridad: 'invalid_priority',
      };

      const result = createInfoRequestSchema.safeParse(invalidPriority);
      expect(result.success).toBe(false);
    });

    it('should validate future deadline dates', () => {
      const pastDeadline = {
        case_id: 'case-123',
        titulo: 'Request',
        descripcion: 'Request with past deadline',
        tipo: 'documento',
        prioridad: 'media',
        fecha_limite: '2020-01-01T23:59:59Z', // Past date
      };

      const result = createInfoRequestSchema.safeParse(pastDeadline);
      expect(result.success).toBe(false);
    });
  });

  describe('TIPOS_SOLICITUD and PRIORIDADES_SOLICITUD', () => {
    it('should have valid request types', () => {
      expect(TIPOS_SOLICITUD.length).toBeGreaterThan(0);
      TIPOS_SOLICITUD.forEach(tipo => {
        expect(tipo).toHaveProperty('value');
        expect(tipo).toHaveProperty('label');
        expect(typeof tipo.value).toBe('string');
        expect(typeof tipo.label).toBe('string');
      });
    });

    it('should have valid priority levels', () => {
      expect(PRIORIDADES_SOLICITUD.length).toBeGreaterThan(0);
      PRIORIDADES_SOLICITUD.forEach(prioridad => {
        expect(prioridad).toHaveProperty('value');
        expect(prioridad).toHaveProperty('label');
        expect(typeof prioridad.value).toBe('string');
        expect(typeof prioridad.label).toBe('string');
      });
    });
  });
});

describe('Magic Links Validators', () => {
  describe('generateMagicLinkSchema', () => {
    it('should validate a complete magic link request', () => {
      const validRequest = {
        email: 'client@example.com',
        case_id: 'case-123',
        expires_in_hours: 24,
        permissions: ['view_case', 'view_documents'],
      };

      const result = generateMagicLinkSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate email format', () => {
      const invalidEmail = {
        email: 'invalid-email',
        case_id: 'case-123',
        expires_in_hours: 24,
        permissions: ['view_case'],
      };

      const result = generateMagicLinkSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
    });

    it('should validate expiration hours range', () => {
      const invalidExpiration = {
        email: 'client@example.com',
        case_id: 'case-123',
        expires_in_hours: 200, // Too long
        permissions: ['view_case'],
      };

      const result = generateMagicLinkSchema.safeParse(invalidExpiration);
      expect(result.success).toBe(false);
    });

    it('should validate permissions array', () => {
      const invalidPermissions = {
        email: 'client@example.com',
        case_id: 'case-123',
        expires_in_hours: 24,
        permissions: ['invalid_permission'],
      };

      const result = generateMagicLinkSchema.safeParse(invalidPermissions);
      expect(result.success).toBe(false);
    });

    it('should require at least one permission', () => {
      const noPermissions = {
        email: 'client@example.com',
        case_id: 'case-123',
        expires_in_hours: 24,
        permissions: [],
      };

      const result = generateMagicLinkSchema.safeParse(noPermissions);
      expect(result.success).toBe(false);
    });
  });

  describe('MAGIC_LINK_PERMISSIONS', () => {
    it('should have valid permission definitions', () => {
      expect(MAGIC_LINK_PERMISSIONS.length).toBeGreaterThan(0);
      MAGIC_LINK_PERMISSIONS.forEach(permission => {
        expect(permission).toHaveProperty('value');
        expect(permission).toHaveProperty('label');
        expect(permission).toHaveProperty('description');
        expect(typeof permission.value).toBe('string');
        expect(typeof permission.label).toBe('string');
        expect(typeof permission.description).toBe('string');
      });
    });

    it('should have unique permission values', () => {
      const values = MAGIC_LINK_PERMISSIONS.map(p => p.value);
      const uniqueValues = [...new Set(values)];
      expect(values.length).toBe(uniqueValues.length);
    });
  });
});

describe('Constants Validation', () => {
  it('should have valid MATERIAS_LEGALES', () => {
    expect(MATERIAS_LEGALES.length).toBeGreaterThan(0);
    MATERIAS_LEGALES.forEach(materia => {
      expect(typeof materia).toBe('string');
      expect(materia.length).toBeGreaterThan(0);
    });
  });

  it('should have valid ESTADOS_CASO', () => {
    expect(ESTADOS_CASO.length).toBeGreaterThan(0);
    ESTADOS_CASO.forEach(estado => {
      expect(typeof estado).toBe('string');
      expect(estado.length).toBeGreaterThan(0);
    });
  });

  it('should have valid PRIORIDADES_CASO', () => {
    expect(PRIORIDADES_CASO.length).toBeGreaterThan(0);
    PRIORIDADES_CASO.forEach(prioridad => {
      expect(typeof prioridad).toBe('string');
      expect(prioridad.length).toBeGreaterThan(0);
    });
  });
});
