'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Search, Filter, Plus, Eye, Edit, MoreHorizontal } from 'lucide-react';
import type { Case } from '@/lib/supabase/types';

interface DataTableProps {
  cases: Case[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onSearch: (search: string) => void;
  onFilter: (filters: any) => void;
  canCreate?: boolean;
  canEdit?: boolean;
}

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

  const totalPages = Math.ceil(total / limit);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      activo: 'default',
      suspendido: 'secondary',
      archivado: 'outline',
      terminado: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      baja: 'bg-gray-100 text-gray-800',
      media: 'bg-blue-100 text-blue-800',
      alta: 'bg-yellow-100 text-yellow-800',
      urgente: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[priority] || 'bg-gray-100 text-gray-800'}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  return (
    <div className='space-y-8'>
      <section className='relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/85 via-white/70 to-white/55 p-6 shadow-[0_40px_90px_-60px_rgba(15,23,42,0.6)] backdrop-blur-xl'>
        <div className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.12),_transparent_55%)]' />
        <CardHeader className='px-0 pt-0 pb-6'>
          <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
            <div>
              <CardTitle className='text-2xl font-semibold text-slate-900'>Casos ({total})</CardTitle>
              <p className='mt-1 text-sm text-slate-500'>
                Gestiona el pipeline jurídico y sigue la salud de cada expediente en tiempo real.
              </p>
            </div>

            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <form onSubmit={handleSearch} className='flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-4 py-2.5 shadow-sm transition hover:border-sky-200 sm:w-auto'>
                <Search className='h-4 w-4 text-slate-400' />
                <Input
                  placeholder='Buscar casos, clientes o materias…'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='border-0 bg-transparent p-0 text-sm focus-visible:ring-0'
                />
                <Button type='submit' size='sm' className='rounded-full px-4'>
                  Buscar
                </Button>
              </form>

              <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row'>
                <Button
                  variant='outline'
                  className='rounded-full border-slate-200 bg-white/70 text-slate-700 hover:border-sky-200 hover:bg-sky-50'
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className='mr-2 h-4 w-4' />
                  Filtros
                </Button>
                {canCreate && (
                  <Button asChild className='rounded-full bg-slate-900 px-5 text-sm font-medium shadow-lg shadow-slate-900/20 hover:bg-slate-800'>
                    <Link href='/cases/new'>
                      <Plus className='mr-2 h-4 w-4' />
                      Nuevo caso
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className='rounded-2xl border border-white/40 bg-white/70 px-4 py-5 shadow-inner'>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>
                  Estado
                </label>
                <select className='mt-2 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100'>
                  <option value=''>Todos</option>
                  <option value='activo'>Activo</option>
                  <option value='suspendido'>Suspendido</option>
                  <option value='archivado'>Archivado</option>
                  <option value='terminado'>Terminado</option>
                </select>
              </div>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>
                  Prioridad
                </label>
                <select className='mt-2 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100'>
                  <option value=''>Todas</option>
                  <option value='baja'>Baja</option>
                  <option value='media'>Media</option>
                  <option value='alta'>Alta</option>
                  <option value='urgente'>Urgente</option>
                </select>
              </div>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>
                  Materia
                </label>
                <select className='mt-2 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100'>
                  <option value=''>Todas</option>
                  <option value='Laboral'>Laboral</option>
                  <option value='Civil'>Civil</option>
                  <option value='Comercial'>Comercial</option>
                  <option value='Penal'>Penal</option>
                </select>
              </div>
              <div className='flex items-end'>
                <Button className='w-full rounded-full bg-slate-900 text-sm font-medium hover:bg-slate-800' onClick={() => onFilter({})}>
                  Aplicar filtros
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </section>

      <section className='rounded-3xl border border-white/15 bg-white/80 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.55)] backdrop-blur-xl'>
        <div className='overflow-x-auto rounded-3xl'>
          <table className='w-full border-separate border-spacing-y-3 px-3'>
            <thead>
              <tr className='text-xs uppercase tracking-[0.2em] text-slate-400'>
                <th className='px-5 text-left'>Caso</th>
                <th className='px-5 text-left'>Cliente</th>
                <th className='px-5 text-left'>Estado</th>
                <th className='px-5 text-left'>Prioridad</th>
                <th className='px-5 text-left'>Etapa</th>
                <th className='px-5 text-left whitespace-nowrap'>Fecha inicio</th>
                <th className='px-5 text-left'>Valor</th>
                <th className='px-5 text-right'>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((caseItem) => (
                <tr key={caseItem.id} className='group overflow-hidden rounded-2xl border border-white/25 bg-white/90 shadow-sm transition hover:-translate-y-1 hover:border-sky-100 hover:bg-white hover:shadow-xl'>
                  <td className='px-5 py-4 align-top'>
                    <div className='space-y-1'>
                      <p className='text-sm font-semibold text-slate-900'>{caseItem.caratulado}</p>
                      {caseItem.numero_causa && (
                        <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-400'>{caseItem.numero_causa}</p>
                      )}
                      {caseItem.materia && (
                        <span className='inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600'>
                          {caseItem.materia}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-5 py-4 align-top'>
                    <div className='space-y-1 text-sm'>
                      <p className='font-medium text-slate-800'>{caseItem.nombre_cliente}</p>
                      {caseItem.rut_cliente && (
                        <p className='text-xs text-slate-500'>{caseItem.rut_cliente}</p>
                      )}
                    </div>
                  </td>
                  <td className='px-5 py-4 align-top'>
                    {getStatusBadge(caseItem.estado || 'activo')}
                  </td>
                  <td className='px-5 py-4 align-top'>
                    {getPriorityBadge(caseItem.prioridad || 'media')}
                  </td>
                  <td className='px-5 py-4 align-top text-sm text-slate-700'>
                    {caseItem.etapa_actual || 'Sin definir'}
                  </td>
                  <td className='px-5 py-4 align-top text-sm text-slate-700'>
                    {caseItem.fecha_inicio ? formatDate(caseItem.fecha_inicio) : <span className='text-slate-400'>Pendiente</span>}
                  </td>
                  <td className='px-5 py-4 align-top text-sm font-semibold text-slate-900'>
                    {caseItem.valor_estimado ? formatCurrency(caseItem.valor_estimado) : <span className='text-slate-400'>-</span>}
                  </td>
                  <td className='px-5 py-4'>
                    <div className='flex items-center justify-end gap-2'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-9 w-9 rounded-full border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
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
                          className='h-9 w-9 rounded-full border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                          asChild
                        >
                          <Link href={`/cases/${caseItem.id}/edit`}>
                            <Edit className='h-4 w-4' />
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-9 w-9 rounded-full border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                      >
                        <MoreHorizontal className='h-4 w-4' />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cases.length === 0 && (
          <div className='flex flex-col items-center justify-center gap-2 px-6 py-16 text-center'>
            <div className='rounded-full bg-slate-100 p-3 text-slate-400'>
              <Search className='h-5 w-5' />
            </div>
            <h3 className='text-base font-semibold text-slate-800'>Sin resultados</h3>
            <p className='max-w-md text-sm text-slate-500'>
              Ajusta la búsqueda o crea un nuevo caso para comenzar a poblar el pipeline de la firma.
            </p>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <div className='flex flex-wrap items-center justify-center gap-3'>
          <Button
            variant='outline'
            className='rounded-full px-4'
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <div className='flex items-center gap-2'>
            {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + index;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  className={`rounded-full ${pageNum === page ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200'}`}
                  size='sm'
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant='outline'
            className='rounded-full px-4'
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
