'use client';

import { useState, useEffect } from 'react';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { getCases } from '@/lib/actions/cases';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen } from 'lucide-react';
import type { Case } from '@/lib/supabase/types';
import type { CaseFiltersInput } from '@/lib/validators/case';

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<CaseFiltersInput>({
    page: 1,
    limit: 10,
  });
  const { toast } = useToast();

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
    loadCases();
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
        canCreate
        canEdit
      />
    );
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900'>
      <main className='mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8'>
        <header className='space-y-2'>
          <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Gestión de cartera</p>
          <h1 className='text-2xl font-semibold tracking-tight'>Casos</h1>
          <p className='max-w-2xl text-sm leading-relaxed text-slate-600'>
            Consulta y actualiza el estado de cada expediente. Usa los filtros para priorizar según vencimientos, estado o tipo de materia.
          </p>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}
