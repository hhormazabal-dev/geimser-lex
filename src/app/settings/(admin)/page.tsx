import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Configuración de la Firma - LEXSER',
};

export default async function AdminSettingsPage() {
  const profile = await requireAuth();

  if (profile.role !== 'admin_firma') {
    redirect('/dashboard');
  }

  return (
    <div className='container mx-auto py-10 space-y-8'>
      <div>
        <h1 className='text-3xl font-bold text-lexser-gray-900'>Configuración</h1>
        <p className='text-sm text-muted-foreground mt-2'>Gestione catálogos, plantillas y reglas de la plataforma.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogos maestros</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4 text-sm text-muted-foreground'>
          <p>Próximamente podrás actualizar tribunales, materias y etapas procesales desde esta pantalla.</p>
          <Separator />
          <p>Mientras tanto, solicita cambios a soporte@lexser.cl.</p>
        </CardContent>
      </Card>
    </div>
  );
}
