import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { requireAuth } from '@/lib/auth/roles';
import { getBillingAccountById } from '@/lib/actions/billing';
import { BillingAccountDetailView } from '@/components/BillingAccountDetailView';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface BillingDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BillingDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Cobro ${id} - Xel Chile` };
}

export default async function BillingDetailPage({ params }: BillingDetailPageProps) {
  const { id } = await params;

  try {
    await requireAuth();
  } catch {
    redirect('/login');
  }

  const result = await getBillingAccountById(id);
  if (!result.success || !result.account) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cobros"
        title={result.account.title}
        description="Detalle del cobro, casos vinculados y registro de pagos."
        actions={
          <Button asChild variant="outline">
            <Link href="/billing" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        }
      />
      <BillingAccountDetailView account={result.account} />
    </div>
  );
}

