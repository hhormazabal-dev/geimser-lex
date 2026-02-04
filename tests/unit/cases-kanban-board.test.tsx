import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

describe('CasesKanbanBoard', () => {
  it('agrega sub-etapas bajo el stage principal (p.ej. Sentencia)', async () => {
    const { CasesKanbanBoard } = await import('@/components/dashboard/CasesKanbanBoard');

    const cases: any[] = [
      {
        case_id: 'c1',
        caratulado: 'Caso A',
        materia: 'Laboral',
        prioridad: 'Baja',
        etapa_actual: 'Sentencia/Tramitación',
        nombre_cliente: 'Cliente A',
        updated_at: '2026-02-01T00:00:00.000Z',
        fecha_proxima: null,
      },
      {
        case_id: 'c2',
        caratulado: 'Caso B',
        materia: 'Laboral',
        prioridad: 'Baja',
        etapa_actual: 'Sentencia',
        nombre_cliente: 'Cliente B',
        updated_at: '2026-02-01T00:00:00.000Z',
        fecha_proxima: null,
      },
      {
        case_id: 'c3',
        caratulado: 'Caso C',
        materia: 'Laboral',
        prioridad: 'Baja',
        etapa_actual: 'Preparatoria',
        nombre_cliente: 'Cliente C',
        updated_at: '2026-02-01T00:00:00.000Z',
        fecha_proxima: null,
      },
    ];

    render(<CasesKanbanBoard cases={cases} />);

    const sentenciaButton = screen
      .getAllByText('Sentencia')
      .map((el) => el.closest('button'))
      .find((el): el is HTMLElement => Boolean(el));
    expect(sentenciaButton).toBeTruthy();
    expect(within(sentenciaButton as HTMLElement).getByText('2')).toBeInTheDocument();

    fireEvent.click(sentenciaButton as HTMLElement);
    expect(screen.getByText('Caso A')).toBeInTheDocument();
    expect(screen.getByText('Caso B')).toBeInTheDocument();
    expect(screen.queryByText('Caso C')).not.toBeInTheDocument();
  });
});
