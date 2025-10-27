// src/app/page.tsx
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  DollarSign,
  FileText,
  FolderKanban,
  MessageCircle,
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

  const featureHighlights = [
    {
      title: 'Casos y cronologías inteligentes',
      description:
        'Centraliza audiencias, etapas y responsables con un timeline visual que mantiene a todo el equipo alineado.',
      icon: Workflow,
    },
    {
      title: 'Clientes, contrapartes y equipos',
      description:
        'Administra datos de contacto, roles y permisos en segundos. Controla quién puede ver cada parte del expediente.',
      icon: Users,
    },
    {
      title: 'Documentos y evidencia segura',
      description:
        'Carga archivos, clasifícalos por visibilidad y comparte enlaces de forma controlada con clientes o el tribunal.',
      icon: Upload,
    },
    {
      title: 'Honorarios, pagos y auditoría',
      description:
        'Define hitos con cobro prepago o variable, registra pagos parciales y deja todo trazado en el historial.',
      icon: DollarSign,
    },
  ] as const;

  const workflowSteps = [
    {
      title: '1. Crea el perfil del cliente',
      description:
        'Ve a “Clientes → Nuevo cliente”. Ingresa datos de contacto, RUT y notas clave para que el equipo tenga contexto inmediato.',
      icon: Users,
    },
    {
      title: '2. Registra un nuevo caso',
      description:
        'En “Casos → Nuevo caso” selecciona al cliente, define materia, tribunal y asigna responsables. El caso queda listo para trabajarse.',
      icon: FolderKanban,
    },
    {
      title: '3. Construye el timeline del expediente',
      description:
        'Dentro del caso, abre la pestaña “Timeline”. Agrega etapas con fechas, responsables, costos y visibilidad para el cliente cuando corresponda.',
      icon: CalendarClock,
    },
    {
      title: '4. Comparte documentos y coordina solicitudes',
      description:
        'Desde las pestañas “Documentos” y “Solicitudes” puedes subir archivos, pedir antecedentes y mantener la conversación centralizada.',
      icon: MessageCircle,
    },
    {
      title: '5. Supervisa honorarios y próximos pasos',
      description:
        'Revisa el bloque de honorarios del caso para ver montos pagados, pendientes o variables, y usa las alertas para no dejar pasar ninguna audiencia.',
      icon: FileText,
    },
  ] as const;

  const quickActions = [
    {
      label: 'Crear cliente',
      description: 'Panel → Clientes → Nuevo cliente',
      icon: Users,
    },
    {
      label: 'Registrar caso',
      description: 'Panel → Casos → Nuevo caso',
      icon: FolderKanban,
    },
    {
      label: 'Añadir etapa',
      description: 'Dentro del caso → Timeline → Nueva etapa',
      icon: Workflow,
    },
    {
      label: 'Subir documento',
      description: 'Caso → Documentos → Subir archivo',
      icon: Upload,
    },
    {
      label: 'Solicitar información',
      description: 'Caso → Solicitudes → Nueva solicitud',
      icon: MessageCircle,
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
        <section className="grid gap-12 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-foreground/60 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              LexChile · Suite Operativa
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Tu estudio con un control total del expediente laboral, civil y comercial.
            </h1>
            <p className="max-w-2xl text-lg text-foreground/65">
              Centraliza clientes, casos, documentos, timeline, solicitudes y honorarios en una
              plataforma diseñada para equipos legales modernos. Sigue los pasos sugeridos y pon tu
              operación en piloto automático con un look &amp; feel de clase mundial.
            </p>
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
                  Ver guía rápida
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground/50">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>
                Auditoría completa, permisos por rol y migraciones listas para Supabase.
              </span>
            </div>
          </div>

          <Card className="rounded-3xl border border-white/40 bg-white/80 shadow-xl backdrop-blur">
            <CardContent className="space-y-6 px-8 py-10">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Atajos para ponerte en marcha
                </h2>
                <p className="mt-1 text-sm text-foreground/55">
                  Los módulos principales del studio están listos. Sigue esta checklist para tu
                  primera causa.
                </p>
              </div>
              <div className="space-y-4">
                {quickActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-start gap-3 rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-foreground/75 shadow-sm"
                    >
                      <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent text-blue-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-foreground/55">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full rounded-full border-white/40 bg-white/60 text-sm font-semibold text-foreground/80 hover:bg-white"
              >
                <Link href={primaryCtaHref}>
                  {isAuthenticated ? 'Ir al dashboard' : 'Ingresar para continuar'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-foreground/45">Qué puedes hacer</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Módulos listos para operar como un estudio boutique.
              </h2>
            </div>
            <p className="max-w-xl text-sm text-foreground/55 md:text-right">
              Cada bloque está integrado con auditoría, RLS y el diseño cuidado que viste en los
              detalles de caso. Personaliza colores o textos cuando quieras, la base UX ya está hecha.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {featureHighlights.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="group rounded-3xl border border-white/40 bg-white/75 shadow-lg backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <CardContent className="flex gap-5 px-7 py-6">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent text-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
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

        <section id="workflow" className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-foreground/45">Guía exprés</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Así creas un caso completo de principio a fin.
              </h2>
            </div>
            <p className="max-w-xl text-sm text-foreground/55 md:text-right">
              Sigue estos pasos en orden para que tu primera causa se vea impecable. Las vistas y
              formularios ya respetan el estilo Glass UI que viste en el detalle de caso.
            </p>
          </div>

          <div className="space-y-4">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-3xl border border-white/30 bg-white/80 px-6 py-5 text-sm text-foreground/70 shadow-sm backdrop-blur transition-all duration-150 hover:border-white/40"
                >
                  <div className="mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent text-emerald-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">{step.title}</p>
                    <p className="text-sm text-foreground/60">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-white/40 bg-white/80 px-8 py-10 text-center text-foreground shadow-xl backdrop-blur-lg md:px-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent text-blue-600">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight">
              ¿Listo para trabajar como los grandes estudios?
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-foreground/60">
              Integra más módulos cuando quieras: analítica, reportes o flujos automáticos ya están
              preparados en la arquitectura. Mientras tanto, usa esta home como tu punto de partida de
              operaciones diarias.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-6 text-base font-semibold shadow-lg">
              <Link href={primaryCtaHref}>{primaryCtaLabel}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-white/40 px-6 text-base text-foreground/75 hover:bg-white/80"
            >
              <Link href="mailto:soporte@lexchile.cl">
                Contactar al equipo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
