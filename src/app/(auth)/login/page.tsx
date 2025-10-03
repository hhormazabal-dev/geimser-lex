import { Metadata } from 'next';
import { LoginForm } from '@/components/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Iniciar Sesión - LEXCHILE',
  description: 'Accede a tu cuenta de LEXCHILE',
};

export default function LoginPage() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-lexchile-blue-50 to-lexchile-gray-100 p-4'>
      <div className='w-full max-w-md space-y-8'>
        {/* Logo y título */}
        <div className='text-center'>
          <div className='flex justify-center mb-6'>
            <Image
              src='/logo.svg'
              alt='LEXCHILE'
              width={200}
              height={60}
              className='h-12 w-auto'
            />
          </div>
          <h1 className='text-3xl font-bold text-lexchile-gray-900'>
            Bienvenido a LEXCHILE
          </h1>
          <p className='mt-2 text-lexchile-gray-600'>
            Plataforma corporativa para estudios jurídicos
          </p>
        </div>

        {/* Formulario de login */}
        <Card className='shadow-xl border-0'>
          <CardHeader className='space-y-1'>
            <CardTitle className='text-2xl text-center text-lexchile-gray-900'>
              Iniciar Sesión
            </CardTitle>
            <CardDescription className='text-center text-lexchile-gray-600'>
              Ingresa tus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        {/* Información adicional */}
        <div className='text-center text-sm text-lexchile-gray-600'>
          <p>
            ¿Problemas para acceder?{' '}
            <a
              href='mailto:soporte@lexchile.cl'
              className='text-lexchile-blue-600 hover:text-lexchile-blue-700 font-medium'
            >
              Contacta soporte
            </a>
          </p>
        </div>

        {/* Usuarios de prueba */}
        <Card className='bg-lexchile-blue-50 border-lexchile-blue-200'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm text-lexchile-blue-900'>
              Usuarios de Prueba
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-xs text-lexchile-blue-800'>
            <div>
              <strong>Admin:</strong> admin@lexchile.cl / admin123
            </div>
            <div>
              <strong>Abogado:</strong> carlos@lexchile.cl / abogado123
            </div>
            <div>
              <strong>Cliente:</strong> juan@cliente.cl / cliente123
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
