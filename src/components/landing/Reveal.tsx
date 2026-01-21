// src/components/landing/Reveal.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

type RevealProps = {
  children: ReactNode;
  className?: string;
};

export function Reveal({ children, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={[
        'transition-all duration-700 ease-out will-change-transform',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
