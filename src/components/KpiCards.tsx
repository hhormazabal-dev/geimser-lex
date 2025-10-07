'use client';

import type { DashboardStats } from '@/lib/actions/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Users, FileText, AlertTriangle } from 'lucide-react';

interface KpiCardsProps {
  stats: DashboardStats;
}

export function KpiCards({ stats }: KpiCardsProps) {
  const items = [
    {
      title: 'Casos totales',
      value: stats.totalCases,
      description: `${stats.activeCases} activos`,
      icon: Briefcase,
      tone: 'text-lexser-blue-600 bg-lexser-blue-100',
    },
    {
      title: 'Clientes',
      value: stats.totalClients,
      description: 'Registrados en la firma',
      icon: Users,
      tone: 'text-emerald-600 bg-emerald-100',
    },
    {
      title: 'Documentos',
      value: stats.totalDocuments,
      description: `${stats.totalNotes} notas`,
      icon: FileText,
      tone: 'text-violet-600 bg-violet-100',
    },
    {
      title: 'Pendientes',
      value: stats.pendingRequests,
      description: `${stats.overdueStages} vencidos`,
      icon: AlertTriangle,
      tone: 'text-amber-600 bg-amber-100',
    },
  ];

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      {items.map(({ title, value, description, icon: Icon, tone }) => (
        <Card key={title} className='border-lexser-gray-100'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>{title}</CardTitle>
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${tone}`}>
              <Icon className='h-4 w-4' />
            </span>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold text-lexser-gray-900'>{value}</div>
            <p className='text-xs text-muted-foreground'>{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
