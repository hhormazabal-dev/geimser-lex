'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

export function SupportFab() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button asChild className="rounded-full shadow-lg">
        <Link href="/support" className="inline-flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />
          Soporte
        </Link>
      </Button>
    </div>
  );
}

