'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className='space-y-6'>
      {/* Header con búsqueda y filtros */}
      <Card>
        <CardHeader>
          <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
            <CardTitle>Casos ({total})</CardTitle>
            <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
              <form onSubmit={handleSearch} className='flex gap-2'>
                <Input
                  placeholder='Buscar casos...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full sm:w-64'
                />
                <Button type='submit' variant='outline' size='icon'>
                  <Search className='h-4 w-4' />
                </Button>
              </form>
              <Button
                variant='outline'
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className='h-4 w-4 mr-2' />
                Filtros
              </Button>
              {canCreate && (
                <Button asChild>
                  <Link href='/cases/new'>
                    <Plus className='h-4 w-4 mr-2' />
                    Nuevo Caso
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        {showFilters && (
          <CardContent className='border-t'>
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <div>
                <label className='block text-sm font-medium mb-1'>Estado</label>
                <select className='form-input'>
                  <option value=''>Todos</option>
                  <option value='activo'>Activo</option>
                  <option value='suspendido'>Suspendido</option>
                  <option value='archivado'>Archivado</option>
                  <option value='terminado'>Terminado</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium mb-1'>Prioridad</label>
                <select className='form-input'>
                  <option value=''>Todas</option>
                  <option value='baja'>Baja</option>
                  <option value='media'>Media</option>
                  <option value='alta'>Alta</option>
                  <option value='urgente'>Urgente</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium mb-1'>Materia</label>
                <select className='form-input'>
                  <option value=''>Todas</option>
                  <option value='Laboral'>Laboral</option>
                  <option value='Civil'>Civil</option>
                  <option value='Comercial'>Comercial</option>
                  <option value='Penal'>Penal</option>
                </select>
              </div>
              <div className='flex items-end'>
                <Button onClick={() => onFilter({})}>
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabla de casos */}
      <Card>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='table'>
              <thead className='table-header'>
                <tr>
                  <th className='table-header-cell'>Caso</th>
                  <th className='table-header-cell'>Cliente</th>
                  <th className='table-header-cell'>Estado</th>
                  <th className='table-header-cell'>Prioridad</th>
                  <th className='table-header-cell'>Etapa</th>
                  <th className='table-header-cell'>Fecha Inicio</th>
                  <th className='table-header-cell'>Valor</th>
                  <th className='table-header-cell'>Acciones</th>
                </tr>
              </thead>
              <tbody className='table-body'>
                {cases.map((caseItem) => (
                  <tr key={caseItem.id} className='table-row'>
                    <td className='table-cell'>
                      <div>
                        <div className='font-medium text-gray-900'>
                          {caseItem.caratulado}
                        </div>
                        {caseItem.numero_causa && (
                          <div className='text-sm text-gray-500'>
                            {caseItem.numero_causa}
                          </div>
                        )}
                        {caseItem.materia && (
                          <div className='text-xs text-gray-400'>
                            {caseItem.materia}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className='table-cell'>
                      <div>
                        <div className='font-medium'>{caseItem.nombre_cliente}</div>
                        {caseItem.rut_cliente && (
                          <div className='text-sm text-gray-500'>
                            {caseItem.rut_cliente}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className='table-cell'>
                      {getStatusBadge(caseItem.estado || 'activo')}
                    </td>
                    <td className='table-cell'>
                      {getPriorityBadge(caseItem.prioridad || 'media')}
                    </td>
                    <td className='table-cell'>
                      <span className='text-sm'>
                        {caseItem.etapa_actual || 'Sin definir'}
                      </span>
                    </td>
                    <td className='table-cell'>
                      {caseItem.fecha_inicio ? (
                        <span className='text-sm'>
                          {formatDate(caseItem.fecha_inicio)}
                        </span>
                      ) : (
                        <span className='text-gray-400'>-</span>
                      )}
                    </td>
                    <td className='table-cell'>
                      {caseItem.valor_estimado ? (
                        <span className='text-sm font-medium'>
                          {formatCurrency(caseItem.valor_estimado)}
                        </span>
                      ) : (
                        <span className='text-gray-400'>-</span>
                      )}
                    </td>
                    <td className='table-cell'>
                      <div className='flex items-center space-x-2'>
                        <Button
                          variant='ghost'
                          size='sm'
                          asChild
                        >
                          <Link href={`/cases/${caseItem.id}`}>
                            <Eye className='h-4 w-4' />
                          </Link>
                        </Button>
                        {canEdit && (
                          <Button
                            variant='ghost'
                            size='sm'
                            asChild
                          >
                            <Link href={`/cases/${caseItem.id}/edit`}>
                              <Edit className='h-4 w-4' />
                            </Link>
                          </Button>
                        )}
                        <Button variant='ghost' size='sm'>
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
            <div className='text-center py-12'>
              <div className='text-gray-500'>
                No se encontraron casos
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className='flex justify-center items-center space-x-2'>
          <Button
            variant='outline'
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          
          <div className='flex items-center space-x-1'>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
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
