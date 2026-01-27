import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/search/route';
import { createServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/roles';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/auth/roles', () => ({
  getCurrentProfile: vi.fn(),
}));

function makeThenableQuery(result: any) {
  const q: any = {
    select: vi.fn(() => q),
    is: vi.fn(() => q),
    not: vi.fn(() => q),
    or: vi.fn(() => q),
    order: vi.fn(() => q),
    limit: vi.fn(() => q),
    eq: vi.fn(() => q),
    maybeSingle: vi.fn(() => q),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(result).catch(reject),
    finally: (onFinally: any) => Promise.resolve(result).finally(onFinally),
  };
  return q;
}

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty payload for short queries', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: 'p1', role: 'admin_firma' } as any);
    vi.mocked(createServerClient).mockResolvedValue({ from: vi.fn() } as any);

    const res = await GET(new Request('http://localhost/api/search?q=a'));
    const body = await res.json();

    expect(body).toEqual({ cases: [], deletedCases: [], clients: [] });
  });

  it('filters out deleted cases for non-trash roles', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: 'p1', role: 'abogado' } as any);

    const activeCasesQuery = makeThenableQuery({
      data: [{ id: 'c1', caratulado: 'Activo', numero_causa: null, materia: null, prioridad: null, workflow_state: null }],
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'cases') return activeCasesQuery;
        throw new Error(`unexpected table ${table}`);
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(supabase as any);

    const res = await GET(new Request('http://localhost/api/search?q=ac'));
    const body = await res.json();

    expect(activeCasesQuery.is).toHaveBeenCalledWith('deleted_at', null);
    expect(body.cases).toHaveLength(1);
    expect(body.deletedCases).toEqual([]);
    expect(body.clients).toEqual([]);
  });

  it('returns deleted cases separately for admin roles', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: 'p1', role: 'admin_firma' } as any);

    const activeCasesQuery = makeThenableQuery({
      data: [{ id: 'c1', caratulado: 'Activo', numero_causa: null, materia: null, prioridad: null, workflow_state: null }],
      error: null,
    });
    const deletedCasesQuery = makeThenableQuery({
      data: [
        {
          id: 'c2',
          caratulado: 'Eliminado',
          numero_causa: 'C-1',
          materia: 'Civil',
          prioridad: null,
          workflow_state: null,
          deleted_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const clientsQuery = makeThenableQuery({
      data: [{ id: 'u1', nombre: 'Cliente', email: 'c@c.com', rut: null }],
      error: null,
    });

    let casesCall = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'cases') {
          casesCall += 1;
          return casesCall === 1 ? activeCasesQuery : deletedCasesQuery;
        }
        if (table === 'profiles') return clientsQuery;
        throw new Error(`unexpected table ${table}`);
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(supabase as any);

    const res = await GET(new Request('http://localhost/api/search?q=el'));
    const body = await res.json();

    expect(activeCasesQuery.is).toHaveBeenCalledWith('deleted_at', null);
    expect(deletedCasesQuery.not).toHaveBeenCalledWith('deleted_at', 'is', null);
    expect(body.cases).toHaveLength(1);
    expect(body.deletedCases).toHaveLength(1);
    expect(body.clients).toHaveLength(1);
  });
});

