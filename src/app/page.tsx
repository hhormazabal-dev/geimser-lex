// src/app/page.tsx
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  DollarSign,
  FolderKanban,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createServerClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(data.session);

  const primaryCtaHref = isAuthenticated ? '/dashboard' : '/login';
  const primaryCtaLabel = isAuthenticated ? 'Ir al panel' : 'Iniciar sesión';

  const uspHighlights = [
    {
      icon: Workflow,
      title: 'Expedientes sincronizados',
      description:
        'Cada caso combina timeline, audiencias, responsables y recordatorios en un solo tablero accionable.',
    },
    {
      icon: Users,
      title: 'Colaboración con contexto',
      description:
        'Clientes, contrapartes y equipo comparten la misma versión del expediente con permisos granulares.',
    },
    {
      icon: Upload,
      title: 'Documentos bajo control',
      description:
        'Sube evidencia, clasifícala por visibilidad y comparte enlaces seguros sin correos ni carpetas duplicadas.',
    },
    {
      icon: DollarSign,
      title: 'Cobranza sin fricción',
      description:
        'Configura hitos con prepago o variable, registra abonos y deja todo trazado para auditorías internas.',
    },
  ] as const;

  const journeySteps = [
    {
      icon: Users,
      title: '1. Levanta al cliente y su historia',
      description:
        'Crea el perfil, registra datos críticos y anota objetivos. El equipo comienza con contexto y sin pedir correcciones.',
      callout: 'Panel → Clientes → Nuevo cliente',
    },
    {
      icon: FolderKanban,
      title: '2. Activa el caso con timeline y responsables',
      description:
        'Define materia, tribunal y etapas clave. El timeline reparte trabajo, plazos y costos desde el día uno.',
      callout: 'Panel → Casos → Nuevo caso',
    },
    {
      icon: CalendarClock,
      title: '3. Coordina ejecución y comunicación',
      description:
        'Documentos, solicitudes, mensajes y pagos ocurren dentro del expediente. Nada se pierde en chats externos.',
      callout: 'Caso → pestañas Documentos / Timeline / Solicitudes',
    },
  ] as const;

  const quickStart = [
    {
      label: 'Registrar primer cliente',
      description: 'Define contacto, notas y permisos.',
      icon: Users,
      href: isAuthenticated ? '/dashboard/clients/new' : '/login',
    },
    {
      label: 'Crear el caso inicial',
      description: 'Asigna materia, responsables y flujo de trabajo.',
      icon: FolderKanban,
      href: isAuthenticated ? '/dashboard/cases/new' : '/login',
    },
    {
      label: 'Diseñar timeline y cobros',
      description: 'Agrega etapas con fechas, responsables y pagos.',
      icon: Workflow,
      href: isAuthenticated ? '/dashboard/cases' : '/login',
    },
  ] as const;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 text-foreground">
      <div className="pointer-events-none absolute inset-0 select-none">
        <span className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl" />
        <span className="absolute right-0 top-56 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
        <span className="absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 pb-24 pt-20 sm:px-8 lg:px-10">
        <section className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="space-y-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-foreground/60 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              LexChile · Suite Operativa
            </span>
            <div className="space-y-5">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                El expediente completo en un solo lugar. Timeline, clientes y cobros siempre sincronizados.
              </h1>
              <p className="max-w-2xl text-lg text-foreground/65">
                Centraliza audiencias, documentos, solicitudes y honorarios. Todo el equipo sabe qué sigue, quién lo ejecuta y cómo se cobra.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full px-6 text-base font-semibold shadow-lg">
                <Link href={primaryCtaHref}>{primaryCtaLabel}</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="rounded-full border border-white/40 px-6 text-base text-foreground/70 hover:text-foreground"
              >
                <Link href="#workflow">
                  Cómo funciona
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground/50">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Roles con permisos granulares, auditoría en tiempo real y stack montado sobre Supabase.</span>
            </div>
          </div>

          <Card className="rounded-3xl border border-white/40 bg-white/85 shadow-xl backdrop-blur">
            <CardContent className="space-y-6 px-8 py-9">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Primeros pasos sugeridos</h2>
                <p className="text-sm text-foreground/55">
                  Tres acciones rápidas para que la plataforma genere valor desde el primer expediente.
                </p>
              </div>
              <div className="space-y-4">
                {quickStart.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-start gap-3 rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-foreground/75 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent text-blue-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-foreground/55">{item.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full rounded-full border-white/40 bg-white/60 text-sm font-semibold text-foreground/80 hover:bg-white"
              >
                <Link href={primaryCtaHref}>
                  {isAuthenticated ? 'Abrir dashboard' : 'Ingresar ahora'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-8">
          <header className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Beneficios que impactan tu operación</h2>
            <p className="text-foreground/55">
              Conecta información, equipo y clientes en torno a un expediente vivo y accionable.
            </p>
          </header>
          <div className="grid gap-6 md:grid-cols-2">
            {uspHighlights.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full rounded-3xl border border-white/40 bg-white/80 shadow-md backdrop-blur">
                  <CardContent className="space-y-4 px-6 py-7">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent text-blue-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                      <p className="text-sm text-foreground/60">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="space-y-8">
          <header className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Un recorrido claro para tu equipo</h2>
            <p className="text-foreground/55">
              Tres hitos para pasar de “tenemos archivos sueltos” a una operación jurídicamente orquestada.
            </p>
          </header>
          <div className="grid gap-6 lg:grid-cols-3">
            {journeySteps.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} className="rounded-3xl border border-white/40 bg-white/80 shadow-md backdrop-blur">
                  <CardContent className="space-y-4 px-6 py-7">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent text-indigo-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                      <p className="text-sm text-foreground/60">{step.description}</p>
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-foreground/45">
                      {step.callout}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <Card className="rounded-3xl border border-white/40 bg-white/85 shadow-xl backdrop-blur">
            <CardContent className="grid gap-8 px-7 py-8 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-foreground">Prepárate para tu próximo expediente</h2>
                <p className="text-sm text-foreground/60">
                  Crea clientes, registra causas y arma el timeline. Al ingresar, continuaremos exactamente donde quedaste.
                </p>
                <Button asChild className="rounded-full px-6 text-sm font-semibold shadow-md">
                  <Link href={primaryCtaHref}>
                    {primaryCtaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <ul className="space-y-3 text-sm text-foreground/65">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Roles y bitácora de auditoría siempre activos.
                </li>
                <li className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-blue-600" />
                  Importa datos desde plantillas o tu gestor actual.
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Timeline visual, solicitudes y cobros listos desde el día uno.
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );

}
