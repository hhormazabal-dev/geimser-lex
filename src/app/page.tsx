
import Link from 'next/link';
import { Playfair_Display, Inter } from 'next/font/google';
import { createServerClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/landing/Navbar';
import { Reveal } from '@/components/landing/Reveal';

const serif = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(data.session);
  const primaryCtaHref = isAuthenticated ? '/dashboard' : '/login';

  return (
    <main className={`${serif.variable} ${sans.variable} font-sans bg-white text-slate-900 selection:bg-blue-900 selection:text-white`}>
      <Navbar ctaHref={primaryCtaHref} />

      {/* Hero Tipográfico - Limpio y Autorizado */}
      <section className="relative pt-40 pb-32 overflow-hidden bg-slate-50 border-b border-slate-200">
        <div className="container mx-auto px-6 lg:px-12 max-w-7xl relative z-10">
          <Reveal>
            <div className="max-w-5xl mx-auto text-center">
              <span className="inline-block py-1.5 px-5 mb-8 text-xs font-bold tracking-[0.2em] uppercase text-blue-800 bg-blue-50 border border-blue-100 rounded-full shadow-sm">
                Software Jurídico de Elite
              </span>
              <h1 className="font-serif text-6xl sm:text-7xl lg:text-9xl text-slate-900 leading-[0.95] mb-12 font-medium tracking-tight">
                Control Total. <br />
                <span className="text-blue-900">Sin Fisuras.</span>
              </h1>
              <p className="text-xl sm:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-light mb-12">
                Centralización. Seguridad. Precisión. <br />
                La infraestructura digital para firmas que no admiten errores.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Link
                  href="https://calendar.app.google/HYTZd6X8eN4zFqYZA"
                  className="inline-flex items-center justify-center px-12 py-6 bg-blue-900 text-white text-sm font-bold tracking-widest uppercase hover:bg-blue-800 transition-all duration-300 rounded-lg shadow-xl"
                >
                  Agendar Demo
                </Link>
                <Link
                  href="#metodologia"
                  className="inline-flex items-center justify-center px-12 py-6 bg-transparent border border-slate-300 text-slate-900 text-sm font-bold tracking-widest uppercase hover:border-blue-900 hover:text-blue-900 transition-all duration-300 rounded-lg"
                >
                  Ver Metodología
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Sección Impacto Humano / Equipo */}
      <section className="py-0 relative">
        <div className="grid lg:grid-cols-2 min-h-[700px]">
          {/* Imagen Cinematográfica Izquierda */}
          <div className="relative h-[500px] lg:h-auto overflow-hidden group">
            <img
              src="/team-meeting.png"
              alt="Equipo legal en reunión estratégica"
              className="absolute inset-0 w-full h-full object-cover grayscale transition-all duration-[10s] group-hover:scale-110 group-hover:grayscale-0"
            />
            <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply"></div>

            <div className="absolute bottom-10 left-10 lg:bottom-20 lg:left-20 text-white max-w-md">
              <p className="font-serif text-3xl mb-4 leading-tight">"Xel transformó nuestra firma. Dejamos de ser reactivos para ser 100% estratégicos."</p>
              <p className="text-sm font-bold uppercase tracking-widest text-blue-200">Socio Director · Firma Corporativa Global</p>
            </div>
          </div>

          {/* Contenido Derecha */}
          <div className="bg-slate-900 text-white flex flex-col justify-center p-12 lg:p-24">
            <Reveal>
              <div className="inline-flex items-center gap-2 text-blue-400 font-bold uppercase tracking-widest text-xs mb-8">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Ecosistema Operativo
              </div>
              <h2 className="font-serif text-4xl lg:text-5xl mb-8 leading-tight text-white">
                Diseñado para la <span className="text-blue-500">Alta Dirección</span>.
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed mb-12">
                Las firmas líderes no pueden permitirse la improvisación. Xel estructura cada proceso crítico: desde la captura de horas hasta el reporte al directorio.
              </p>

              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="h-12 w-12 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                    <span className="font-serif font-bold text-xl">1</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Centralización Absoluta</h3>
                    <p className="text-slate-400">Toda la inteligencia de la firma en un solo "Single Source of Truth".</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="h-12 w-12 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                    <span className="font-serif font-bold text-xl">2</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Visibilidad Ejecutiva</h3>
                    <p className="text-slate-400">Dashboards en tiempo real para socios. Tome decisiones basadas en data, no intuición.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ROI & Resultados (Clean White) */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 lg:px-12 max-w-7xl text-center">
          <Reveal>
            <h2 className="font-serif text-3xl text-slate-900 mb-16">Resultados medibles</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 border border-slate-100 bg-slate-50 shadow-sm rounded-2xl hover:shadow-xl transition-all duration-300">
                <p className="text-6xl font-serif text-blue-900 mb-4">40%</p>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Más Eficiencia</p>
              </div>
              <div className="p-8 border border-slate-100 bg-slate-50 shadow-sm rounded-2xl hover:shadow-xl transition-all duration-300">
                <p className="text-6xl font-serif text-blue-900 mb-4">Zero</p>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Pérdida de Información</p>
              </div>
              <div className="p-8 border border-slate-100 bg-slate-50 shadow-sm rounded-2xl hover:shadow-xl transition-all duration-300">
                <p className="text-6xl font-serif text-blue-900 mb-4">ISO</p>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Seguridad 27001</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Feature Deep Dive (Parallax-ish) */}
      <section id="metodologia" className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="font-serif text-4xl text-slate-900 mb-6">Metodología Xel</h2>
              <p className="text-lg text-slate-600">
                Más que un software, es una forma de trabajar. Estructura, orden y profesionalismo en cada interacción.
              </p>
            </div>
          </Reveal>

          <div className="space-y-32">
            {/* Bloque 1 - Gestión */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <Reveal>
                <div className="order-2 lg:order-1 relative p-2 bg-white rounded-2xl shadow-xl border border-slate-200 rotate-1 hover:rotate-0 transition-transform duration-500">
                  <img src="/dashboard-straight.png" className="rounded-xl w-full" alt="Gestión de Casos" />
                </div>
              </Reveal>
              <Reveal delay={0.2} className="order-1 lg:order-2">
                <div className="pl-0 lg:pl-10">
                  <h3 className="font-serif text-3xl text-slate-900 mb-6">1. Control de Expedientes</h3>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    Cada caso tiene un ciclo de vida definido. Nada queda en el aire. El sistema fuerza el orden mediante hitos obligatorios y recordatorios inteligentes sincronizados con el tribunal.
                  </p>
                  <Link href="#" className="text-blue-800 font-bold uppercase tracking-widest text-xs border-b border-blue-800 pb-1 hover:text-blue-600 hover:border-blue-600 transition-colors">
                    Explorar módulo de casos
                  </Link>
                </div>
              </Reveal>
            </div>

            {/* Bloque 2 - Enfoque */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <Reveal delay={0.2} className="order-1">
                <div className="pr-0 lg:pr-10">
                  <h3 className="font-serif text-3xl text-slate-900 mb-6">2. Foco en la Estrategia</h3>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    Mientras Xel automatiza el seguimiento y el papeleo, sus abogados senior pueden dedicarse a lo que mejor saben hacer: ganar casos.
                  </p>
                  <Link href="#" className="text-blue-800 font-bold uppercase tracking-widest text-xs border-b border-blue-800 pb-1 hover:text-blue-600 hover:border-blue-600 transition-colors">
                    Ver herramientas de productividad
                  </Link>
                </div>
              </Reveal>
              <Reveal>
                <div className="order-2 relative p-2 bg-white rounded-2xl shadow-xl border border-slate-200 -rotate-1 hover:rotate-0 transition-transform duration-500">
                  <img src="/lawyer-focus.png" className="rounded-xl w-full" alt="Abogado enfocado" />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Final Premium Call to Action */}
      <section className="py-32 bg-blue-900 text-white text-center relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/20 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          <Reveal>
            <h2 className="font-serif text-5xl lg:text-6xl mb-8 leading-tight">
              Eleve el estándar de su firma hoy.
            </h2>
            <p className="text-xl text-blue-200 mb-12 max-w-2xl mx-auto">
              La diferencia entre un estudio tradicional y una firma corporativa moderna es Xel.
            </p>
            <Link
              href="https://calendar.app.google/HYTZd6X8eN4zFqYZA"
              className="inline-flex items-center justify-center px-12 py-6 bg-white text-blue-900 text-lg font-bold tracking-widest uppercase hover:bg-blue-50 transition-all duration-300 rounded-lg shadow-2xl hover:-translate-y-1"
            >
              Agendar Reunión Privada
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer minimalista */}
      <footer className="bg-white py-16 border-t border-slate-200">
        <div className="container mx-auto px-6 lg:px-12 max-w-7xl flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h4 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-3">
              <span className="w-4 h-4 bg-blue-900 rounded-sm"></span>
              Xel Chile
            </h4>
            <p className="text-xs text-slate-400 mt-2 uppercase tracking-wider">Sistema Operativo Legal Corporativo</p>
          </div>
          <div className="flex gap-8 text-sm text-slate-500 font-medium">
            <Link href="/login" className="hover:text-blue-900 transition-colors">Portal de Clientes</Link>
            <Link href="#" className="hover:text-blue-900 transition-colors">Privacidad y Seguridad</Link>
            <a href="tel:+56227121162" className="hover:text-blue-900 transition-colors">
              Contacto: 227121162
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
