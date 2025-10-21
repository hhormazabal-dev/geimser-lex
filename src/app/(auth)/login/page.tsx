import type { Metadata } from 'next'
import { Suspense } from 'react'
import LoginForm from '@/components/LoginForm' // <— IMPORT DEFAULT
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Iniciar Sesión - Xel Chile',
  description: 'Accede a tu cuenta de Xel Chile',
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(96,165,250,0.25),_transparent_45%)]" />
      <div className="absolute inset-x-0 top-0 mx-auto h-48 w-full max-w-3xl rounded-full bg-white/50 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 gap-10 lg:grid-cols-[1.2fr,1fr]">
        <div className="hidden rounded-3xl border border-white/10 bg-white/30 p-10 backdrop-blur-2xl lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/40 px-3 py-1 text-xs font-semibold text-foreground/60">
              Plataforma corporativa
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Gestiona tu estudio jurídico con una experiencia premium
            </h1>
            <p className="max-w-sm text-sm text-foreground/60">
              Xel Chile centraliza casos, documentos, timelines procesales y comunicación con clientes en una
              interfaz diseñada para equipos legales modernos.
            </p>
          </div>
          <div className="space-y-4 text-sm text-foreground/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-sm font-semibold text-foreground">
                01
              </div>
              <div>
                <p className="font-medium text-foreground">Seguridad de nivel corporativo</p>
                <p className="text-xs text-foreground/60">Autenticación robusta y trazabilidad total de acciones.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-sm font-semibold text-foreground">
                02
              </div>
              <div>
                <p className="font-medium text-foreground">Experiencia centrada en el cliente</p>
                <p className="text-xs text-foreground/60">Portal intuitivo con timelines, documentación y seguimiento.</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="relative rounded-3xl border border-white/20 bg-white/75 p-8 shadow-2xl backdrop-blur-2xl">
          <CardHeader className="space-y-3 text-center">
            <div className="flex justify-center">
              <Image src="/logo.svg" alt="Xel Chile" width={160} height={48} className="h-10 w-auto" priority />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold text-foreground">Bienvenido de vuelta</CardTitle>
              <CardDescription className="text-sm text-foreground/60">
                Ingresa tus credenciales para continuar gestionando la firma
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Suspense fallback={<p className="text-center text-sm text-foreground/50">Cargando formulario...</p>}>
              <LoginForm />
            </Suspense>
            <p className="text-center text-xs text-foreground/50">
              ¿Problemas para acceder?{' '}
              <a href="mailto:soporte@xelchile.cl" className="font-medium text-primary hover:text-primary/80">
                Contacta soporte
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
