// src/app/page.tsx
import Link from 'next/link';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import { createServerClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/landing/Navbar';
import { Reveal } from '@/components/landing/Reveal';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const heroSignals = [
  {
    title: 'Control visible',
    description: 'El estudio sabe qué ocurre, quién decide y cómo avanza cada expediente.',
  },
  {
    title: 'Método sostenido',
    description: 'La operación replica estándares sin desviaciones entre equipos y sedes.',
  },
  {
    title: 'Confianza demostrable',
    description: 'Toda acción queda respaldada con registros claros y acceso controlado.',
  },
] as const;

const logoCloud = ['Orion Legal', 'Círculo & Asociados', 'Atlas Corporate', 'Rocca Partners', 'Valora', 'Norte & Sur'];

const productSections = [
  {
    eyebrow: 'Producto · Operación jurídica',
    title: 'Casos y línea de tiempo con orden quirúrgico.',
    description:
      'Cada expediente reúne datos críticos, etapas procesales y responsabilidades claras. El equipo trabaja en sincronía con visibilidad total de lo que sigue.',
    points: [
      'Gestión integral de casos',
      'Línea de tiempo procesal por materia',
      'Documentos con versiones ordenadas',
      'Notas internas y colaboración',
    ],
    visual: (
      <svg viewBox="0 0 360 260" className="h-full w-full" fill="none" aria-hidden="true">
        <rect x="20" y="24" width="320" height="212" rx="16" fill="#0b0b0b" stroke="#1f2937" strokeWidth="1.2" />
        <rect x="44" y="52" width="120" height="18" rx="9" fill="#a3e635" />
        <rect x="44" y="88" width="90" height="8" rx="4" fill="#334155" />
        <rect x="44" y="110" width="160" height="8" rx="4" fill="#1f2937" />
        <rect x="44" y="132" width="200" height="8" rx="4" fill="#1f2937" />
        <rect x="44" y="154" width="130" height="8" rx="4" fill="#1f2937" />
        <circle cx="258" cy="110" r="40" fill="#111827" />
        <path d="M258 76v34l22 16" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" />
        <circle cx="258" cy="110" r="28" stroke="#1f2937" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    eyebrow: 'Producto · Relación con clientes',
    title: 'Un portal privado que eleva la percepción del estudio.',
    description:
      'Clientes informados sin perder control. Solicitudes, mensajes y documentos se ordenan en un entorno sobrio y seguro.',
    points: [
      'Portal privado para clientes',
      'Solicitudes de información trazables',
      'Notificaciones automáticas',
      'Comunicación centralizada',
    ],
    visual: (
      <svg viewBox="0 0 360 260" className="h-full w-full" fill="none" aria-hidden="true">
        <rect x="24" y="28" width="312" height="204" rx="18" fill="#0b0b0b" stroke="#1f2937" strokeWidth="1.2" />
        <rect x="48" y="54" width="100" height="12" rx="6" fill="#a3e635" />
        <rect x="48" y="78" width="200" height="8" rx="4" fill="#1f2937" />
        <rect x="48" y="100" width="180" height="8" rx="4" fill="#1f2937" />
        <rect x="48" y="122" width="140" height="8" rx="4" fill="#1f2937" />
        <rect x="48" y="152" width="120" height="48" rx="12" fill="#111827" stroke="#1f2937" strokeWidth="1" />
        <rect x="186" y="152" width="120" height="48" rx="12" fill="#111827" stroke="#1f2937" strokeWidth="1" />
        <path d="M86 176h44" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" />
        <path d="M224 176h44" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" />
        <circle cx="290" cy="78" r="22" fill="#111827" stroke="#1f2937" strokeWidth="1.2" />
        <path d="M284 78l6 6 10-12" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    eyebrow: 'Producto · Gobierno corporativo',
    title: 'Dirección con control y auditoría completa.',
    description:
      'Indicadores ejecutivos, carga operativa y decisiones críticas respaldadas. La firma opera con seguridad avanzada y trazabilidad total.',
    points: [
      'Panel ejecutivo de dirección',
      'Auditoría íntegra',
      'Accesos por rol',
      'Firmas separadas',
      'Seguridad avanzada',
    ],
    visual: (
      <svg viewBox="0 0 360 260" className="h-full w-full" fill="none" aria-hidden="true">
        <rect x="26" y="30" width="308" height="200" rx="20" fill="#0b0b0b" stroke="#1f2937" strokeWidth="1.2" />
        <rect x="52" y="56" width="120" height="10" rx="5" fill="#a3e635" />
        <rect x="52" y="78" width="80" height="8" rx="4" fill="#1f2937" />
        <rect x="52" y="120" width="80" height="60" rx="12" fill="#111827" stroke="#1f2937" strokeWidth="1" />
        <rect x="148" y="120" width="80" height="60" rx="12" fill="#111827" stroke="#1f2937" strokeWidth="1" />
        <rect x="244" y="120" width="80" height="60" rx="12" fill="#111827" stroke="#1f2937" strokeWidth="1" />
        <path d="M72 160v-18M88 160v-28M104 160v-12" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" />
        <path d="M168 160l16-20 16 20" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" />
        <circle cx="284" cy="146" r="16" stroke="#a3e635" strokeWidth="2" />
        <path d="M284 138v12" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

const testimonials = [
  {
    quote:
      '“La percepción del cliente cambió por completo. Hoy ve claridad, método y liderazgo en cada interacción.”',
    name: 'Marcela Torres',
    role: 'Socia directora · Estudio Atlas',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
  },
  {
    quote:
      '“Xel nos dio gobierno operativo sin fricción. El equipo se alineó y la dirección recuperó control.”',
    name: 'Rafael Ibáñez',
    role: 'CEO · Roca & Partners',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
  },
  {
    quote:
      '“La comunicación con clientes ahora es ordenada y premium. El estudio luce como una firma global.”',
    name: 'Camila Figueroa',
    role: 'Gerente legal · Orion',
    image: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=400&q=80',
  },
] as const;

const faqs = [
  {
    question: '¿Xel funciona para firmas con varias sedes?',
    answer:
      'Sí. Las firmas separadas permiten operar múltiples sedes con datos aislados y controlados.',
  },
  {
    question: '¿Cómo se mantiene el control sobre la información sensible?',
    answer:
      'El sistema define accesos por rol, con trazabilidad completa para cada acción crítica.',
  },
  {
    question: '¿Se puede acompañar al cliente sin perder orden?',
    answer:
      'El portal privado y las solicitudes trazables permiten informar al cliente sin salir del entorno controlado.',
  },
  {
    question: '¿Qué asegura el liderazgo ejecutivo?',
    answer:
      'Paneles ejecutivos con indicadores claros, auditoría total y notificaciones automáticas en cada hito.',
  },
] as const;

const footerColumns = [
  {
    title: 'Productos',
    links: ['Gestión de casos', 'Documentos', 'Línea de tiempo', 'Portal cliente'],
  },
  {
    title: 'Soluciones',
    links: ['Estudios corporativos', 'Multi-sede', 'Compliance', 'Dirección ejecutiva'],
  },
  {
    title: 'Recursos',
    links: ['Metodología Xel', 'Guías', 'Blog'],
  },
  {
    title: 'Nosotros',
    links: ['Equipo', 'Cultura', 'Seguridad'],
  },
  {
    title: 'Legal',
    links: ['Privacidad', 'Términos', 'Cookies'],
  },
] as const;

export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(data.session);

  const primaryCtaHref = isAuthenticated ? '/dashboard' : '/login';

  return (
    <main className={`${body.className} bg-white text-slate-900`}>
      <Navbar ctaHref={primaryCtaHref} />

      <section className="relative overflow-hidden bg-black pb-16 pt-28 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="hero-glow absolute -left-40 top-20 h-80 w-80 rounded-full bg-lime-300/20 blur-[120px]" />
          <div className="hero-glow absolute right-0 top-16 h-96 w-96 rounded-full bg-white/10 blur-[150px]" />
          <div className="hero-grid absolute inset-0 opacity-20" />
          <div className="hero-orbit absolute left-1/3 top-10 h-40 w-40 rounded-full border border-lime-300/40" />
        </div>

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-8 lg:px-10">
          <Reveal className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.32em] text-white/70">
                <span className="h-2 w-2 rounded-full bg-lime-300" />
                Xel Chile · Suite corporativa
              </div>
              <h1 className={`${display.className} text-4xl font-semibold leading-tight text-white sm:text-5xl`}>
                Una operación jurídica que se siente moderna, segura y bajo control.
              </h1>
              <p className="max-w-2xl text-lg text-white/70">
                Xel centraliza casos, documentos, comunicaciones y decisiones en un entorno privado con lenguaje ejecutivo
                y estándares corporativos.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href={primaryCtaHref}
                  className="rounded-lg bg-lime-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-black transition duration-300 hover:scale-105 hover:bg-lime-200"
                >
                  Agenda una demo
                </Link>
                <Link
                  href="#metodo"
                  className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/80 transition duration-300 hover:scale-105 hover:border-lime-300/70 hover:text-lime-200"
                >
                  Ver metodología
                </Link>
              </div>
              <div className="grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-3">
                {heroSignals.map((signal) => (
                  <div key={signal.title} className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">{signal.title}</p>
                    <p className="text-sm text-white/70">{signal.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
                <div className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <div className="hero-motion absolute inset-0" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/60" />
                  <div className="absolute bottom-5 left-5 right-5 space-y-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Sala de control</p>
                    <p className={`${display.className} text-2xl text-white`}>
                      Dirección ejecutiva en tiempo real.
                    </p>
                    <p className="text-sm text-white/70">
                      Métricas, plazos y comunicación reunidos en un solo lugar.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {['Casos activos', 'Clientes informados', 'Decisiones trazables'].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-xs uppercase tracking-[0.2em] text-white/60 transition duration-300 hover:-translate-y-1 hover:border-lime-300/60"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
          <Reveal className="space-y-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Confían en estructuras sólidas</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {logoCloud.map((name) => (
                <div
                  key={name}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 grayscale transition duration-300 hover:-translate-y-1 hover:border-lime-300 hover:text-lime-500 hover:grayscale-0"
                >
                  <span>{name}</span>
                  <svg viewBox="0 0 48 48" className="h-6 w-6 transition duration-300 group-hover:rotate-6" fill="none" aria-hidden="true">
                    <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M20 24l4 4 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="productos" className="bg-white py-16">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
          <Reveal className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Nuestros productos</p>
            <h2 className={`${display.className} text-3xl font-semibold text-slate-900`}>
              Jerarquía, método y control en cada frente operativo.
            </h2>
            <p className="max-w-3xl text-slate-600">
              Un diseño pensado para estudios corporativos que necesitan precisión, orden y una experiencia premium para
              sus clientes.
            </p>
          </Reveal>

          <div className="mt-12 space-y-14">
            {productSections.map((section, index) => (
              <Reveal key={section.title}>
                <div className="grid items-center gap-10 lg:grid-cols-2">
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <div className="space-y-5">
                      <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-4 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
                        {section.eyebrow}
                      </span>
                      <h3 className={`${display.className} text-2xl font-semibold text-slate-900`}>
                        {section.title}
                      </h3>
                      <p className="text-slate-600">{section.description}</p>
                      <ul className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                        {section.points.map((point) => (
                          <li key={point} className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-lime-400" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-black/95 p-6 transition duration-300 hover:-translate-y-2 hover:border-lime-300 hover:shadow-[0_30px_60px_rgba(17,24,39,0.2)]">
                      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-black">
                        <div className="h-full w-full transition duration-300 group-hover:scale-105">
                          {section.visual}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="casos-exito" className="relative overflow-hidden bg-black py-16 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="hero-glow absolute -right-20 top-10 h-72 w-72 rounded-full bg-lime-300/10 blur-[140px]" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
          <Reveal className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Casos de éxito</p>
              <h2 className={`${display.className} text-3xl font-semibold text-white`}>
                Resultados visibles en equipos que necesitan control total.
              </h2>
              <p className="text-white/70">
                Estudios corporativos adoptan Xel para estandarizar su operación, elevar su percepción y asegurar cada
                decisión con trazabilidad.
              </p>
              <div className="flex flex-wrap gap-4">
                {['+42% eficiencia operativa', '98% clientes informados', '24/7 control ejecutivo'].map((metric) => (
                  <div
                    key={metric}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/70"
                  >
                    {metric}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Caso destacado</p>
              <p className={`${display.className} text-2xl text-white`}>
                “Hoy nuestra firma opera como un solo equipo, con control absoluto del expediente.”
              </p>
              <p className="text-sm text-white/60">Socio director · Estudio corporativo internacional</p>
              <Link
                href="#contacto"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-lime-200 transition hover:text-lime-300"
              >
                Conocer más
                <span>→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="metodo" className="bg-white py-16">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
          <Reveal className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Método Xel</p>
              <h2 className={`${display.className} text-3xl font-semibold text-slate-900`}>
                Una ruta clara que ordena equipos, tiempos y comunicación.
              </h2>
              <p className="text-slate-600">
                Desde la admisión hasta el cierre, todo ocurre dentro de un entorno controlado que proyecta liderazgo.
              </p>
            </div>
            <div className="space-y-8 border-l border-slate-200 pl-8">
              {[
                {
                  step: '01',
                  title: 'Admisión con criterio',
                  description: 'Estructuras claras para definir expectativas, plazos y responsables.',
                },
                {
                  step: '02',
                  title: 'Ejecución con control',
                  description: 'Comunicación, documentos y solicitudes dentro del mismo entorno.',
                },
                {
                  step: '03',
                  title: 'Cierre con respaldo',
                  description: 'Resultados entregados con registro total y narrativa impecable.',
                },
              ].map((item) => (
                <div key={item.step} className="relative space-y-2">
                  <div className="absolute -left-[38px] top-1 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
          <Reveal className="space-y-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Testimonios</p>
            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.map((item) => (
                <div
                  key={item.name}
                  className="group rounded-xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-2 hover:border-lime-300 hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
                >
                  <div className="overflow-hidden rounded-lg">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-5 text-sm text-slate-600 transition duration-300 group-hover:translate-y-1">
                    {item.quote}
                  </p>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
          <Reveal className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Preguntas frecuentes</p>
              <h2 className={`${display.className} text-3xl font-semibold text-slate-900`}>
                Respuestas claras para decisiones rápidas.
              </h2>
              <p className="text-slate-600">
                Xel está diseñado para firmas que necesitan rigor operativo con una experiencia premium.
              </p>
            </div>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-xl border border-slate-200 bg-white p-5 transition duration-300 hover:border-lime-300"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900">
                    {faq.question}
                    <span className="relative h-5 w-5 text-lime-400">
                      <span className="faq-horizontal absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 bg-current transition duration-300" />
                      <span className="faq-vertical absolute left-1/2 top-0 h-5 w-[2px] -translate-x-1/2 bg-current transition duration-300" />
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="contacto" className="bg-black py-16 text-white">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
          <Reveal className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Agenda una demo</p>
              <h2 className={`${display.className} text-3xl font-semibold text-white`}>
                Una operación corporativa que se siente impecable desde el día uno.
              </h2>
              <p className="text-white/70">
                Coordina una demostración privada y descubre cómo Xel ordena la relación con tus clientes y fortalece la
                dirección del estudio.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white/70">
                  contacto@xelchile.com
                </div>
                <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white/70">
                  +56 2 2345 6789
                </div>
                <Link
                  href={primaryCtaHref}
                  className="flex items-center justify-center rounded-lg bg-lime-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-black transition duration-300 hover:scale-105 hover:bg-lime-200"
                >
                  Agendar ahora
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="bg-white py-12">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
          <div className="grid gap-10 border-t border-slate-200 pt-10 lg:grid-cols-[1.2fr_2fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lime-500">
                  <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path d="M12 24h24M24 12v24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                Xel Chile
              </div>
              <p className="text-sm text-slate-600">
                Plataforma corporativa para estudios jurídicos que requieren orden, seguridad y una experiencia premium.
              </p>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                LinkedIn · Vimeo · YouTube
              </div>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {footerColumns.map((column) => (
                <div key={column.title} className="space-y-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{column.title}</p>
                  <div className="space-y-2 text-slate-600">
                    {column.links.map((link) => (
                      <p key={link} className="transition hover:text-slate-900">
                        {link}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <span>© 2025 Xel Chile. Todos los derechos reservados.</span>
            <span>Privacidad · Términos · Compliance</span>
          </div>
        </div>
      </footer>

    </main>
  );
}
