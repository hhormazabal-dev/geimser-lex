// src/components/landing/Navbar.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const menu = [
  {
    label: 'Soluciones',
    href: '#problemas',
  },
  {
    label: 'Producto',
    href: '#showcase',
  },
  {
    label: 'Resultados',
    href: '#impacto',
  },
  {
    label: 'Precios',
    href: '#precios',
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
        'fixed left-0 top-0 z-50 w-full transition-all duration-300 font-sans',
        scrolled
          ? 'bg-white/95 shadow-lg backdrop-blur-md border-b border-slate-200/50'
          : 'bg-slate-900/80 backdrop-blur-md border-b border-white/10',
      ].join(' ')}
    >
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className={`flex items-center gap-3 text-sm font-bold tracking-[0.2em] uppercase transition-colors ${scrolled ? 'text-slate-900 hover:text-slate-700' : 'text-white hover:text-blue-200'
            }`}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded ${scrolled ? 'bg-slate-900 text-white' : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'
            }`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Xel Chile
        </Link>

        {/* Desktop Menu */}
        <div className={`hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.15em] lg:flex ${scrolled ? 'text-slate-600' : 'text-white/80'
          }`}>
          {menu.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`transition hover:-translate-y-0.5 ${scrolled ? 'hover:text-slate-900' : 'hover:text-white'
                }`}
            >
              {item.label}
            </Link>
          ))}
          <Link href="#contacto" className={`transition hover:-translate-y-0.5 ${scrolled ? 'hover:text-slate-900' : 'hover:text-white'}`}>
            Contacto
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={ctaHref}
            className={`rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 shadow-sm hover:shadow-md ${scrolled
              ? 'bg-blue-900 text-white hover:bg-blue-800'
              : 'bg-white text-blue-900 hover:bg-blue-50'
              }`}
          >
            Portal
          </Link>
        </div>
      </nav>
    </header>
  );
}

