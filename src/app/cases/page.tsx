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

  if (isLoading) {
    return (
      <div className='container mx-auto py-8'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 bg-gray-200 rounded w-1/4'></div>
          <div className='h-64 bg-gray-200 rounded'></div>
        </div>
      </div>
    );
  }

  if (cases.length === 0 && !filters.search) {
    return (
      <div className='container mx-auto py-8'>
        <EmptyState
          icon={FolderOpen}
          title='No hay casos'
          description='Aún no se han creado casos en el sistema. Crea tu primer caso para comenzar.'
          action={{
            label: 'Crear Primer Caso',
            onClick: () => window.location.href = '/cases/new',
          }}
        />
      </div>
    );
  }

  return (
    <div className='container mx-auto py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Casos</h1>
        <p className='text-gray-600 mt-2'>
          Gestiona todos los casos jurídicos del estudio
        </p>
      </div>

      <DataTable
        cases={cases}
        total={total}
        page={page}
        limit={filters.limit}
        onPageChange={handlePageChange}
        onSearch={handleSearch}
        onFilter={handleFilter}
        canCreate={true}
        canEdit={true}
      />
    </div>
  );
}
