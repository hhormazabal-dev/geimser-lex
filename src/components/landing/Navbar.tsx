// src/components/landing/Navbar.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const menu = [
  {
    label: 'Productos',
    items: ['Gestión de casos', 'Documentos', 'Línea de tiempo', 'Portal cliente'],
  },
  {
    label: 'Soluciones',
    items: ['Estudios corporativos', 'Equipos multi-sede', 'Operación de cumplimiento', 'Dirección ejecutiva'],
  },
  {
    label: 'Recursos',
    items: ['Guías de operación', 'Metodología Xel', 'Blog corporativo'],
  },
  {
    label: 'Nosotros',
    items: ['Equipo', 'Cultura', 'Seguridad'],
  },
] as const;

export function Navbar({ ctaHref }: { ctaHref: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={[
        'fixed left-0 top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-black/90 shadow-[0_12px_40px_rgba(0,0,0,0.35)]'
          : 'bg-black/40 backdrop-blur-xl',
      ].join(' ')}
    >
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-white sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.32em] uppercase">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-lime-300/60 text-lime-300">
            <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M12 24h24M24 12v24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          Xel Chile
        </Link>

        <div className="hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.2em] lg:flex">
          {menu.map((item) => (
            <div key={item.label} className="group relative">
              <button type="button" className="flex items-center gap-2 text-white/80 transition hover:text-lime-200">
                {item.label}
                <span className="text-[10px] transition group-hover:rotate-180">▾</span>
              </button>
              <div className="pointer-events-none absolute left-0 top-8 w-56 translate-y-2 rounded-xl border border-white/10 bg-black/95 p-4 text-[11px] uppercase tracking-[0.2em] text-white/70 opacity-0 transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                <div className="space-y-2">
                  {item.items.map((subItem) => (
                    <div key={subItem} className="flex items-center justify-between">
                      <span className="transition group-hover:text-white">{subItem}</span>
                      <span className="text-lime-300/70">→</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <Link href="#casos-exito" className="text-white/80 transition hover:text-lime-200">
            Casos de éxito
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="#contacto"
            className="hidden rounded-lg border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-lime-300/70 hover:text-lime-200 md:inline-flex"
          >
            Contáctanos
          </Link>
          <Link
            href={ctaHref}
            className="rounded-lg bg-lime-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition duration-300 hover:scale-105 hover:bg-lime-200"
          >
            Agenda una demo
          </Link>
        </div>
      </nav>
    </header>
  );
}
