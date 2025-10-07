import type { Metadata } from 'next'
import { Suspense } from 'react'
import LoginForm from '@/components/LoginForm' // <— IMPORT DEFAULT
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Iniciar Sesión - LEXSER',
  description: 'Accede a tu cuenta de LEXSER',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lexser-blue-50 to-lexser-gray-100 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image src="/logo.svg" alt="LEXSER" width={200} height={60} className="h-12 w-auto" priority />
          </div>
          <h1 className="text-3xl font-bold text-lexser-gray-900">Bienvenido a LEXSER</h1>
          <p className="mt-2 text-lexser-gray-600">Plataforma corporativa para estudios jurídicos</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-lexser-gray-900">Iniciar Sesión</CardTitle>
            <CardDescription className="text-center text-lexser-gray-600">
              Ingresa tus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-center text-gray-500">Cargando formulario...</p>}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-lexser-gray-600">
          <p>
            ¿Problemas para acceder?{' '}
            <a href="mailto:soporte@lexser.cl" className="text-lexser-blue-600 hover:text-lexser-blue-700 font-medium">
              Contacta soporte
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}
