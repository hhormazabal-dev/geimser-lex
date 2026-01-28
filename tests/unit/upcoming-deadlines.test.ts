import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getUpcomingDeadlines48h } from '@/lib/actions/analytics-personal';
import { createServerClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/auth/roles', () => ({
  requireAuth: vi.fn(),
}));

describe('getUpcomingDeadlines48h', () => {
  const mockProfile = {
    id: 'user-123',
    role: 'abogado',
    nombre: 'Test Lawyer',
  };

  const mockSupabaseClient = {
    from: vi.fn(),
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    // 2026-01-28 18:50 en Chile (America/Santiago) ~= 2026-01-28T21:50:00Z (UTC-3)
    vi.setSystemTime(new Date('2026-01-28T21:50:00.000Z'));
    vi.clearAllMocks();

    (createServerClient as any).mockResolvedValue(mockSupabaseClient);
    const rolesModule = await import('@/lib/auth/roles');
    vi.mocked(rolesModule.requireAuth).mockResolvedValue(mockProfile as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('interprets DATE in Chile timezone (no UTC shift)', async () => {
    const stages = [
      {
        case_id: 'case-1',
        etapa: 'Audiencia de juicio',
        fecha_programada: '2026-01-29',
        estado: 'pendiente',
      },
      // Candidate within date range (today..today+2), but should be filtered out if >48h
      {
        case_id: 'case-2',
        etapa: 'Audiencia de juicio',
        fecha_programada: '2026-01-30',
        estado: 'pendiente',
      },
    ];

    const cases = [
      { id: 'case-1', caratulado: 'ROMERO/BARRIONUEVO', prioridad: 'alta', abogado_responsable: 'user-123' },
      { id: 'case-2', caratulado: 'OTRO/OTRO', prioridad: 'media', abogado_responsable: 'user-123' },
    ];

    const stagesQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: stages, error: null }),
    };

    const casesQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: cases, error: null }),
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'case_stages') return stagesQuery;
      if (table === 'cases') return casesQuery;
      return {};
    });

    const result = await getUpcomingDeadlines48h();

    expect(result.success).toBe(true);
    expect(result.data?.map((d) => d.caseId)).toEqual(['case-1']);
    expect(result.data?.[0]?.fechaProgramada).toBe('2026-01-29');
    // En la hora de referencia, el fin del día 29 en Chile queda ~29h por delante.
    expect(result.data?.[0]?.horasRestantes).toBe(29);
  });
});

