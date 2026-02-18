
import Link from 'next/link';
import Image from 'next/image';
import { Playfair_Display, Inter } from 'next/font/google';
import { createServerClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/landing/Navbar';
import { Reveal } from '@/components/landing/Reveal';
import { ContactForm } from '@/components/landing/ContactForm';
import { Pricing } from '@/components/landing/Pricing';
import {
  Clock,
  FolderOpen,
  Receipt,
  BarChart3,
  Users,
  TrendingUp,
  Phone,
  Target,
  Rocket,
  CheckCircle2
} from 'lucide-react';

const serif = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const problemCards = [
  {
    icon: Clock,
    title: 'Plazos Perdidos',
    description: 'Nunca más olvides un vencimiento judicial. Alertas automáticas sincronizadas con el Poder Judicial.',
  },
  {
    icon: FolderOpen,
    title: 'Información Dispersa',
    description: 'Todo en un solo lugar: documentos, notas, comunicaciones y estados de cada caso.',
  },
  {
    icon: Receipt,
    title: 'Facturación Caótica',
    description: 'Control preciso de horas, gastos y honorarios. Genera facturas profesionales en segundos.',
  },
  {
    icon: BarChart3,
    title: 'Sin Visibilidad',
    description: 'Dashboards en tiempo real para socios. Conoce el estado de tu firma de un vistazo.',
  },
  {
    icon: Users,
    title: 'Clientes Desconectados',
    description: 'Portal de clientes donde pueden ver el avance de sus casos sin llamarte.',
  },
  {
    icon: TrendingUp,
    title: 'Decisiones a Ciegas',
    description: 'Analytics avanzados. Toma decisiones basadas en datos, no en intuición.',
  },
];

const features = [
  {
    title: 'Dashboard 360° del Abogado',
    description: 'Visualiza tu carga de trabajo en tiempo real, distribución de horas por materia, pipeline de casos desde demanda hasta cierre, y alertas de plazos críticos.',
    image: '/3.png',
  },
  {
    title: 'Panel Ejecutivo de Negocio',
    description: 'Controla facturación mensual, tiempo promedio de resolución, funnel de conversión de consultas a casos ganados, y desempeño de cada abogado con heatmaps.',
    image: '/2.png',
  },
  {
    title: 'Seguridad y Auditoría',
    description: 'Monitorea eventos de seguridad, sesiones activas, alertas críticas, intentos de login y timeline de actividad. Cumplimiento normativo garantizado.',
    image: '/1.png',
  },
];

export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(data.session);
  const primaryCtaHref = isAuthenticated ? '/dashboard' : '/login';

  return (
    <main className={`${serif.variable} ${sans.variable} font-sans bg-white text-slate-900 selection:bg-blue-900 selection:text-white`}>
      <Navbar ctaHref={primaryCtaHref} />

      {/* Hero Cinematográfico con Video */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Video de fondo */}
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/1.mp4" type="video/mp4" />
          </video>
          {/* Overlay oscuro para legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-slate-900/70" />
          {/* Glows sutiles */}
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-indigo-500/15 blur-[100px] rounded-full" />
        </div>

        <div className="container mx-auto px-6 lg:px-12 max-w-7xl relative z-10 py-32">
          <div className="max-w-3xl">
            {/* Texto Hero */}
            <Reveal>
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <span className="px-4 py-2 bg-blue-500/10 backdrop-blur-sm border border-blue-400/20 rounded-full text-blue-300 text-xs font-bold uppercase tracking-widest">
                    Legal CRM #1 en Chile
                  </span>
                </div>

                <h1 className="font-serif text-5xl lg:text-7xl text-white leading-[1.1] mb-8">
                  Gestión legal{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                    potenciada.
                  </span>
                </h1>

                <p className="text-xl lg:text-2xl text-slate-300 max-w-2xl leading-relaxed mb-12">
                  Automatiza lo operativo. Visualiza lo estratégico.
                  <span className="text-white font-medium"> Xel centraliza toda la inteligencia de tu estudio</span> para que te dediques a lo que importa: ganar casos.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="https://calendar.app.google/HYTZd6X8eN4zFqYZA"
                    className="magnetic-btn inline-flex items-center justify-center px-10 py-5 bg-white text-blue-900 text-sm font-bold tracking-wide uppercase hover:bg-blue-50 transition-all duration-300 rounded-xl shadow-2xl shadow-white/10 hover:-translate-y-0.5 animate-pulse-glow"
                  >
                    Agendar Demo Gratis
                  </Link>
                  <Link
                    href="#problemas"
                    className="magnetic-btn inline-flex items-center justify-center px-10 py-5 bg-white/5 backdrop-blur-sm border border-white/10 text-white text-sm font-bold tracking-wide uppercase hover:bg-white/10 transition-all duration-300 rounded-xl"
                  >
                    Ver Beneficios
                  </Link>
                </div>

                {/* Stats inline */}
                <div className="flex flex-wrap gap-8 mt-16 pt-8 border-t border-white/10">
                  <div>
                    <p className="text-4xl font-serif text-white">+500</p>
                    <p className="text-sm text-slate-400">Abogados activos</p>
                  </div>
                  <div>
                    <p className="text-4xl font-serif text-white">40%</p>
                    <p className="text-sm text-slate-400">Más eficiencia</p>
                  </div>
                  <div>
                    <p className="text-4xl font-serif text-white">99.9%</p>
                    <p className="text-sm text-slate-400">Uptime garantizado</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Logos de Confianza */}
      <section className="py-12 bg-slate-50 border-y border-slate-200">
        <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
          <p className="text-center text-sm font-medium text-slate-400 uppercase tracking-widest mb-8">
            Estudios jurídicos en Chile confían en Xel
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            {['Estudio Legal Corporativo', 'Bufete Asociados', 'Legal Partners', 'Abogados Corp', 'Jurídica Nacional'].map((name, i) => (
              <div key={i} className="text-slate-400 font-serif text-lg font-semibold">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problemas que Resolvemos */}
      <section id="problemas" className="py-24 lg:py-32 bg-white">
        <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-20">
              <span className="inline-block text-blue-800 font-bold uppercase tracking-widest text-xs mb-4">
                ¿Te suena familiar?
              </span>
              <h2 className="font-serif text-4xl lg:text-5xl text-slate-900 mb-6">
                Los problemas que <span className="text-blue-900">eliminamos</span>
              </h2>
              <p className="text-lg text-slate-600">
                Cada uno de estos dolores afecta la rentabilidad y reputación de tu firma. Xel los resuelve de raíz.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {problemCards.map((problem, index) => {
              const IconComponent = problem.icon;
              return (
                <Reveal key={index} delay={index * 0.1}>
                  <div className="group p-8 bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl hover:shadow-xl hover:border-blue-100 hover:-translate-y-1 transition-all duration-300">
                    <div className="w-14 h-14 mb-6 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center group-hover:scale-110 group-hover:from-blue-200 group-hover:to-blue-100 transition-all duration-300">
                      <IconComponent className="w-7 h-7 text-blue-800" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">
                      {problem.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      {problem.description}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Showcase del Producto */}
      <section id="showcase" className="py-24 lg:py-32 bg-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="container mx-auto px-6 lg:px-12 max-w-7xl relative z-10">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-20">
              <span className="inline-block text-blue-400 font-bold uppercase tracking-widest text-xs mb-4">
                Plataforma Integral
              </span>
              <h2 className="font-serif text-4xl lg:text-5xl text-white mb-6">
                Todo lo que tu firma necesita
              </h2>
              <p className="text-lg text-slate-400">
                Una sola plataforma que centraliza casos, clientes, documentos, facturación y analytics.
              </p>
            </div>
          </Reveal>

          <div className="space-y-24">
            {features.map((feature, index) => (
              <div key={index} className={`grid lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
                <Reveal delay={0.1} className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                  <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative bg-white/5 border border-white/10 rounded-2xl p-2 overflow-hidden">
                      <Image
                        src={feature.image}
                        alt={feature.title}
                        width={700}
                        height={500}
                        className="rounded-xl w-full"
                      />
                    </div>
                  </div>
                </Reveal>

                <Reveal delay={0.2} className={index % 2 === 1 ? 'lg:col-start-1' : ''}>
                  <div className={index % 2 === 1 ? 'lg:pr-12' : 'lg:pl-12'}>
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-6">
                      <span className="text-blue-400 font-bold text-xl">{index + 1}</span>
                    </div>
                    <h3 className="font-serif text-3xl text-white mb-4">{feature.title}</h3>
                    <p className="text-lg text-slate-400 leading-relaxed mb-6">{feature.description}</p>
                    <Link
                      href="#contacto"
                      className="inline-flex items-center text-blue-400 font-semibold hover:text-blue-300 transition-colors group"
                    >
                      Conocer más
                      <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial / Impacto */}
      <section id="impacto" className="py-0 relative">
        <div className="grid lg:grid-cols-2 min-h-[600px]">
          {/* Imagen */}
          <div className="relative h-[400px] lg:h-auto overflow-hidden group">
            <Image
              src="/lawyer-executive.png"
              alt="Abogado ejecutivo trabajando"
              fill
              className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/60 to-blue-900/40" />

            <div className="absolute bottom-10 left-10 lg:bottom-16 lg:left-16 text-white max-w-lg">
              <p className="font-serif text-2xl lg:text-3xl mb-4 leading-tight">
                "Xel transformó nuestra forma de trabajar. Pasamos de Excel y carpetas físicas a tener todo centralizado en una plataforma que realmente entiende cómo opera un estudio legal."
              </p>
              <p className="text-sm font-bold uppercase tracking-widest text-blue-200">
                Socio Director · Firma Legal Top 20 Chile
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-blue-900 text-white flex flex-col justify-center p-12 lg:p-20">
            <Reveal>
              <h2 className="font-serif text-3xl lg:text-4xl mb-12 text-white">
                Resultados <span className="text-blue-300">comprobados</span>
              </h2>

              <div className="grid grid-cols-2 gap-8">
                <div className="border-l-2 border-blue-400 pl-6">
                  <p className="text-5xl font-serif text-white mb-2">40%</p>
                  <p className="text-sm uppercase tracking-widest text-blue-200">Más eficiencia</p>
                </div>
                <div className="border-l-2 border-blue-400 pl-6">
                  <p className="text-5xl font-serif text-white mb-2">0</p>
                  <p className="text-sm uppercase tracking-widest text-blue-200">Plazos perdidos</p>
                </div>
                <div className="border-l-2 border-blue-400 pl-6">
                  <p className="text-5xl font-serif text-white mb-2">24/7</p>
                  <p className="text-sm uppercase tracking-widest text-blue-200">Acceso clientes</p>
                </div>
                <div className="border-l-2 border-blue-400 pl-6">
                  <p className="text-5xl font-serif text-white mb-2">ISO</p>
                  <p className="text-sm uppercase tracking-widest text-blue-200">Seguridad 27001</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <Pricing />

      {/* Formulario de Contacto */}
      <section id="contacto" className="py-24 lg:py-32 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-50" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/50 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-100/50 blur-[80px] rounded-full" />

        <div className="container mx-auto px-6 lg:px-12 max-w-7xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Info */}
            <Reveal>
              <div>
                <span className="inline-block text-blue-800 font-bold uppercase tracking-widest text-xs mb-4">
                  Comienza hoy
                </span>
                <h2 className="font-serif text-4xl lg:text-5xl text-slate-900 mb-6">
                  ¿Listo para transformar tu firma?
                </h2>
                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  Cuéntanos sobre tu estudio y te mostraremos cómo Xel puede ayudarte a operar como las grandes firmas corporativas.
                </p>

                <div className="space-y-6 mb-10">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                      <Phone className="w-5 h-5 text-blue-800" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Llamada de Descubrimiento</h4>
                      <p className="text-slate-600 text-sm">30 minutos para entender tus desafíos</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                      <Target className="w-5 h-5 text-blue-800" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Demo Personalizada</h4>
                      <p className="text-slate-600 text-sm">Te mostramos Xel con casos reales</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                      <Rocket className="w-5 h-5 text-blue-800" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Implementación Guiada</h4>
                      <p className="text-slate-600 text-sm">Te acompañamos en todo el proceso</p>
                    </div>
                  </div>
                </div>

                {/* Direct Contact */}
                <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 mb-2">¿Prefieres contacto directo?</p>
                  <a href="mailto:contacto@xel.cl" className="text-blue-800 font-bold text-lg hover:text-blue-600 transition-colors">
                    contacto@xel.cl
                  </a>
                  <span className="mx-3 text-slate-300">|</span>
                  <a href="tel:+56227121163" className="text-blue-800 font-bold text-lg hover:text-blue-600 transition-colors">
                    +56 2 2712 1163
                  </a>
                </div>
              </div>
            </Reveal>

            {/* Formulario */}
            <Reveal delay={0.2}>
              <div className="bg-white rounded-3xl p-8 lg:p-10 shadow-xl border border-slate-100">
                <h3 className="font-serif text-2xl text-slate-900 mb-2">Escríbenos</h3>
                <p className="text-slate-500 mb-8">Responderemos en menos de 24 horas hábiles.</p>
                <ContactForm />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA Final - Con fondo de edificios corporativos */}
      <section className="py-32 text-white text-center relative overflow-hidden">
        {/* Imagen de fondo */}
        <div className="absolute inset-0">
          <Image
            src="/hero-office.png"
            alt="Vista corporativa"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/90 to-slate-900/70" />
        </div>

        {/* Efecto de brillo */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/15 blur-[180px] rounded-full" />
        </div>

        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-300 mb-6">
              Únete a los estudios líderes
            </p>
            <h2 className="font-serif text-4xl lg:text-6xl mb-6 leading-tight">
              El futuro de la práctica legal <span className="text-blue-300">ya llegó.</span>
            </h2>
            <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              Las firmas que adoptan tecnología hoy lideran mañana. No te quedes atrás.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="https://calendar.app.google/HYTZd6X8eN4zFqYZA"
                className="magnetic-btn inline-flex items-center justify-center px-10 py-5 bg-white text-blue-900 text-sm font-bold tracking-widest uppercase hover:bg-blue-50 transition-all duration-300 rounded-xl shadow-2xl hover:-translate-y-1 animate-pulse-glow"
              >
                Agendar Reunión Privada
              </Link>
              <Link
                href="#contacto"
                className="magnetic-btn inline-flex items-center justify-center px-10 py-5 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-bold tracking-widest uppercase hover:bg-white/20 transition-all duration-300 rounded-xl"
              >
                Escribir Mensaje
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-16 border-t border-slate-200">
        <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <h4 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-3 mb-4">
                <span className="w-4 h-4 bg-blue-900 rounded-sm" />
                Xel Chile
              </h4>
              <p className="text-slate-600 max-w-md mb-6">
                Sistema Operativo Legal para estudios jurídicos que buscan eficiencia, control y profesionalismo.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-blue-100 hover:text-blue-800 transition-colors">
                  in
                </a>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 mb-4">Producto</h5>
              <ul className="space-y-3 text-slate-600">
                <li><Link href="#problemas" className="hover:text-blue-800 transition-colors">Características</Link></li>
                <li><Link href="#contacto" className="hover:text-blue-800 transition-colors">Precios</Link></li>
                <li><Link href="/login" className="hover:text-blue-800 transition-colors">Portal Clientes</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 mb-4">Contacto</h5>
              <ul className="space-y-3 text-slate-600">
                <li>
                  <a href="mailto:contacto@xel.cl" className="hover:text-blue-800 transition-colors">
                    contacto@xel.cl
                  </a>
                </li>
                <li>
                  <a href="tel:+56227121163" className="hover:text-blue-800 transition-colors">
                    +56 2 2712 1163
                  </a>
                </li>
                <li className="text-sm">Santiago, Chile</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Xel Chile. Todos los derechos reservados.
            </p>
            <div className="flex gap-6 text-sm text-slate-500">
              <Link href="#" className="hover:text-blue-800 transition-colors">Privacidad</Link>
              <Link href="#" className="hover:text-blue-800 transition-colors">Términos</Link>
              <Link href="#" className="hover:text-blue-800 transition-colors">Seguridad</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
