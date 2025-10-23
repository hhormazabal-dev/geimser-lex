'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Search, Filter, Plus, Eye, Edit, X } from 'lucide-react';
import type { Case } from '@/lib/supabase/types';

type CaseWithParties = Case & {
  counterparties?: Array<{ nombre: string; tipo: string }>;
};

interface DataTableProps {
  cases: CaseWithParties[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onSearch: (search: string) => void;
  onFilter: (filters: any) => void;
  canCreate?: boolean;
  canEdit?: boolean;
}

const STATUS_VARIANTS: Record<string, { label: string; chipClass: string }> = {
  activo: { label: 'Activo', chipClass: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  suspendido: { label: 'Suspendido', chipClass: 'bg-amber-50 text-amber-700 border border-amber-100' },
  archivado: { label: 'Archivado', chipClass: 'bg-slate-100 text-slate-600 border border-slate-200' },
  terminado: { label: 'Terminado', chipClass: 'bg-sky-50 text-sky-700 border border-sky-100' },
};

const PRIORITY_VARIANTS: Record<string, string> = {
  baja: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  media: 'bg-sky-50 text-sky-700 border border-sky-100',
  alta: 'bg-amber-50 text-amber-700 border border-amber-100',
  urgente: 'bg-red-50 text-red-600 border border-red-100',
};

export function DataTable({
  cases,
  total,
  page,
  limit,
  onPageChange,
  onSearch,
  onFilter,
  canCreate = false,
  canEdit = false,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState<{ estado: string; prioridad: string; materia: string }>({
    estado: '',
    prioridad: '',
    materia: '',
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSearch(searchTerm.trim());
  };

  const handleFilterChange = (field: 'estado' | 'prioridad' | 'materia') => (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFilterValues((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    const cleaned = Object.fromEntries(
      Object.entries(filterValues)
        .filter(([, value]) => value)
        .map(([key, value]) => [key, value])
    );
    onFilter(cleaned);
  };

  const resetFilters = () => {
    setFilterValues({ estado: '', prioridad: '', materia: '' });
    onFilter({});
  };

  const activeFilters = Object.values(filterValues).filter(Boolean).length;

  const renderStatusBadge = (status?: string | null) => {
    const key = (status ?? '').toLowerCase();
    const config = STATUS_VARIANTS[key];
    if (!config) {
      return (
        <span className='inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600'>
          Sin estado
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${config.chipClass}`}>
        {config.label}
      </span>
    );
  };

  const renderPriorityBadge = (priority?: string | null) => {
    const key = (priority ?? 'media').toLowerCase();
    const classes = PRIORITY_VARIANTS[key] ?? 'bg-slate-100 text-slate-600 border border-slate-200';
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${classes}`}>
        {key}
      </span>
    );
  };

  return (
    <div className='space-y-6'>
      <Card className='border border-slate-200 bg-white/95 shadow-sm'>
        <div className='flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-1'>
            <p className='text-sm font-semibold text-slate-900'>Casos ({total})</p>
            <p className='text-sm text-slate-500'>Monitorea el avance y prioriza dónde actuar primero.</p>
          </div>

          <div className='flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center'>
            <form onSubmit={handleSearchSubmit} className='flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:w-[280px]'>
              <Search className='h-4 w-4 text-slate-400' />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Buscar casos o clientes'
                className='border-0 bg-transparent p-0 text-sm focus-visible:ring-0'
              />
              <Button type='submit' size='sm' variant='secondary'>
                Buscar
              </Button>
            </form>

            <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <Button
                variant='outline'
                onClick={() => setShowFilters((prev) => !prev)}
                className='flex items-center gap-2 rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50'
              >
                <Filter className='h-4 w-4' />
                Filtros {activeFilters > 0 && <span className='rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white'>{activeFilters}</span>}
              </Button>

              {canCreate && (
                <Button asChild className='rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800'>
                  <Link href='/cases/new'>
                    <Plus className='mr-2 h-4 w-4' />
                    Nuevo caso
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {showFilters && (
          <div className='border-t border-slate-200 bg-slate-50/60 px-5 py-4'>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <div>
                <label className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>Estado</label>
                <select
                  value={filterValues.estado}
                  onChange={handleFilterChange('estado')}
                  className='mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100'
                >
                  <option value=''>Todos</option>
                  <option value='activo'>Activo</option>
                  <option value='suspendido'>Suspendido</option>
                  <option value='archivado'>Archivado</option>
                  <option value='terminado'>Terminado</option>
                </select>
              </div>

              <div>
                <label className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>Prioridad</label>
                <select
                  value={filterValues.prioridad}
                  onChange={handleFilterChange('prioridad')}
                  className='mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100'
                >
                  <option value=''>Todas</option>
                  <option value='baja'>Baja</option>
                  <option value='media'>Media</option>
                  <option value='alta'>Alta</option>
                  <option value='urgente'>Urgente</option>
                </select>
              </div>

              <div>
                <label className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>Materia</label>
                <select
                  value={filterValues.materia}
                  onChange={handleFilterChange('materia')}
                  className='mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100'
                >
                  <option value=''>Todas</option>
                  <option value='Laboral'>Laboral</option>
                  <option value='Civil'>Civil</option>
                  <option value='Comercial'>Comercial</option>
                  <option value='Penal'>Penal</option>
                </select>
              </div>

              <div className='flex items-end gap-2'>
                <Button onClick={applyFilters} className='w-full rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800'>
                  Aplicar filtros
                </Button>
                {activeFilters > 0 && (
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={resetFilters}
                    className='h-10 w-10 rounded-xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white'
                  >
                    <X className='h-4 w-4' />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className='overflow-hidden border border-slate-200 bg-white/95 shadow-sm'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-slate-200 text-sm'>
            <thead className='bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>
              <tr>
                <th scope='col' className='px-5 py-3 text-left'>Caso</th>
                <th scope='col' className='px-5 py-3 text-left'>Cliente</th>
                <th scope='col' className='px-5 py-3 text-left'>Contrapartes</th>
                <th scope='col' className='px-5 py-3 text-left'>Estado</th>
                <th scope='col' className='px-5 py-3 text-left'>Prioridad</th>
                <th scope='col' className='px-5 py-3 text-left'>Etapa</th>
                <th scope='col' className='px-5 py-3 text-left whitespace-nowrap'>Inicio</th>
                <th scope='col' className='px-5 py-3 text-left'>Valor</th>
                <th scope='col' className='px-5 py-3 text-right'>Acciones</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100 text-slate-700'>
              {cases.map((caseItem) => (
                <tr key={caseItem.id} className='transition-colors hover:bg-slate-50/70'>
                  <td className='px-5 py-4 align-top'>
                    <div className='space-y-1'>
                      <p className='text-sm font-semibold text-slate-900'>{caseItem.caratulado}</p>
                      {caseItem.numero_causa && (
                        <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-400'>{caseItem.numero_causa}</p>
                      )}
                      {caseItem.materia && (
                        <span className='inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600'>
                          {caseItem.materia}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-5 py-4 align-top'>
                    <div className='space-y-1'>
                      <p className='text-sm font-medium text-slate-800'>{caseItem.nombre_cliente}</p>
                      {caseItem.rut_cliente && <p className='text-xs text-slate-500'>{caseItem.rut_cliente}</p>}
                    </div>
                  </td>
                  <td className='px-5 py-4 align-top'>
                    {caseItem.counterparties && caseItem.counterparties.length > 0 ? (
                      <div className='space-y-1 text-xs text-slate-600'>
                        {caseItem.counterparties.slice(0, 3).map((party, index) => (
                          <div key={`${party.nombre}-${index}`} className='flex items-center gap-2'>
                            <Badge variant='outline' className='border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-600'>
                              {party.tipo}
                            </Badge>
                            <span className='text-slate-700'>{party.nombre}</span>
                          </div>
                        ))}
                        {caseItem.counterparties.length > 3 && (
                          <span className='text-[11px] font-medium text-slate-400'>+{caseItem.counterparties.length - 3} más</span>
                        )}
                      </div>
                    ) : (
                      <span className='text-xs text-slate-400'>Sin registrar</span>
                    )}
                  </td>
                  <td className='px-5 py-4 align-top'>{renderStatusBadge(caseItem.estado)}</td>
                  <td className='px-5 py-4 align-top'>{renderPriorityBadge(caseItem.prioridad)}</td>
                  <td className='px-5 py-4 align-top text-sm'>{caseItem.etapa_actual || 'Sin definir'}</td>
                  <td className='px-5 py-4 align-top text-sm'>
                    {caseItem.fecha_inicio ? formatDate(caseItem.fecha_inicio) : <span className='text-slate-400'>Pendiente</span>}
                  </td>
                  <td className='px-5 py-4 align-top text-sm font-semibold text-slate-900'>
                    {caseItem.valor_estimado ? formatCurrency(caseItem.valor_estimado) : <span className='font-normal text-slate-400'>-</span>}
                  </td>
                  <td className='px-5 py-4 align-top'>
                    <div className='flex items-center justify-end gap-2'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-9 w-9 rounded-full border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                        asChild
                      >
                        <Link href={`/cases/${caseItem.id}`}>
                          <Eye className='h-4 w-4' />
                        </Link>
                      </Button>
                      {canEdit && (
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-9 w-9 rounded-full border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                          asChild
                        >
                          <Link href={`/cases/${caseItem.id}/edit`}>
                            <Edit className='h-4 w-4' />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cases.length === 0 && (
          <div className='flex flex-col items-center justify-center gap-3 px-6 py-16 text-center'>
            <div className='rounded-full bg-slate-100 p-3 text-slate-400'>
              <Search className='h-5 w-5' />
            </div>
            <h3 className='text-base font-semibold text-slate-800'>Sin resultados</h3>
            <p className='max-w-md text-sm text-slate-500'>
              Ajusta la búsqueda o crea un nuevo caso para poblar el pipeline.
            </p>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className='flex flex-wrap items-center justify-center gap-3'>
          <Button
            variant='outline'
            className='rounded-xl px-4'
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <div className='flex items-center gap-2'>
            {(() => {
              const pagesToShow = Math.min(5, totalPages);
              const startPage = Math.max(1, Math.min(page - Math.floor(pagesToShow / 2), totalPages - pagesToShow + 1));

              return Array.from({ length: pagesToShow }, (_, index) => {
                const pageNum = startPage + index;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? 'default' : 'outline'}
                    className={`rounded-xl px-3 ${pageNum === page ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200'}`}
                    size='sm'
                    onClick={() => onPageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              });
            })()}
          </div>
          <Button
            variant='outline'
            className='rounded-xl px-4'
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
