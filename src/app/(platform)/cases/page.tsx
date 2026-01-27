'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { getCases } from '@/lib/actions/cases';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen } from 'lucide-react';
import type { Case } from '@/lib/supabase/types';
import type { CaseFiltersInput } from '@/lib/validators/case';

export default function CasesPage() {
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<CaseFiltersInput>({
    page: 1,
    limit: 10,
  });
  const { toast } = useToast();
  const [uiSeed, setUiSeed] = useState<{
    search: string;
    initialFilters: { estado?: string; prioridad?: string; workflow_state?: string; materia?: string };
  }>({ search: '', initialFilters: {} });
  const [sortState, setSortState] = useState<{ column: string; order: 'asc' | 'desc' }>({
    column: 'created_at',
    order: 'desc',
  });

  const loadCases = async (newFilters: CaseFiltersInput = filters) => {
    setIsLoading(true);
    try {
      const result = await getCases(newFilters);

      if (result.success) {
        setCases(result.cases);
        setTotal(result.total);
        setPage(result.page || 1);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al cargar casos',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading cases:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar casos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const estado = searchParams.get('estado') ?? undefined;
    const prioridad = searchParams.get('prioridad') ?? undefined;
    const workflow_state = searchParams.get('workflow_state') ?? undefined;
    const materia = searchParams.get('materia') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');

    const nextFilters: CaseFiltersInput = {
      page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 10,
      ...(estado ? { estado: estado as any } : {}),
      ...(prioridad ? { prioridad: prioridad as any } : {}),
      ...(workflow_state ? { workflow_state: workflow_state as any } : {}),
      ...(materia ? { materia } : {}),
      ...(search ? { search } : {}),
    };

    setFilters(nextFilters);
    setUiSeed({
      search: search ?? '',
      initialFilters: {
        ...(estado ? { estado } : {}),
        ...(prioridad ? { prioridad } : {}),
        ...(workflow_state ? { workflow_state } : {}),
        ...(materia ? { materia } : {}),
      },
    });
    loadCases(nextFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (newPage: number) => {
    const newFilters = { ...filters, page: newPage };
    setFilters(newFilters);
    loadCases(newFilters);
  };

  const handleSearch = (search: string) => {
    const newFilters = { ...filters, search, page: 1 };
    setFilters(newFilters);
    loadCases(newFilters);
  };

  const handleFilter = (newFilters: any) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    setFilters(updatedFilters);
    loadCases(updatedFilters);
  };

  const handleSort = (column: string) => {
    setSortState((prev) => {
      const isSameColumn = prev.column === column;
      const newOrder: 'asc' | 'desc' = isSameColumn && prev.order === 'desc' ? 'asc' : 'desc';
      const nextSort = { column, order: newOrder };

      const updatedFilters = {
        ...filters,
        sort_by: column as any,
        order: newOrder,
        page: 1, // Reset page on sort? Often good UX.
      };
      setFilters(updatedFilters);
      loadCases(updatedFilters);
      return nextSort;
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className='space-y-6'>
          <div className='h-9 w-48 rounded-lg bg-slate-200/70' />
          <div className='h-72 rounded-2xl border border-slate-100 bg-white/70 shadow-sm backdrop-blur' />
        </div>
      );
    }

    if (cases.length === 0 && !filters.search) {
      return (
        <EmptyState
          icon={FolderOpen}
          title='No hay casos'
          description='Aún no se han creado casos en el sistema. Crea tu primer caso para comenzar.'
          action={{
            label: 'Crear primer caso',
            onClick: () => {
              window.location.href = '/cases/new';
            },
          }}
        />
      );
    }

    return (
      <DataTable
        cases={cases}
        total={total}
        page={page}
        limit={filters.limit}
        onPageChange={handlePageChange}
        onSearch={handleSearch}
        onFilter={handleFilter}
        initialSearchTerm={uiSeed.search}
        initialFilterValues={uiSeed.initialFilters}
        canCreate
        canEdit
        onSort={handleSort}
        sortState={sortState}
      />
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Gestión de cartera"
        title="Casos"
        description="Consulta y actualiza el estado de cada expediente. Usa los filtros para priorizar según vencimientos, estado o tipo de materia."
      />

      {renderContent()}
    </div>
  );
}
