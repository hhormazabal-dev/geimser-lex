import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default function SupportPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Centro de ayuda"
        title="Soporte"
        description="Guías rápidas y canales de contacto para resolver dudas operativas."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              Escribe a <span className="font-medium text-slate-900">soporte@altiusignite.com</span> con el número de
              causa (si aplica) y una descripción breve.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href="mailto:soporte@altiusignite.com?subject=Soporte%20Xel%20Chile">Enviar correo</a>
              </Button>
              <Button asChild>
                <Link href="/inbox">Ir al Inbox</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Buenas prácticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              Para mantener métricas consistentes, evita editar fechas clave sin revisar el timeline del expediente y el
              estado de pagos.
            </p>
            <p>
              Usa <span className="font-medium text-slate-900">Cobros</span> para registrar pagos e historial, y deja en
              el expediente solo los datos jurídicos.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <div>
            <p className="font-medium text-slate-900">¿Cómo marco un caso como “Terminado”?</p>
            <p className="mt-1">
              En la edición del caso, selecciona el estado “Terminado” y adjunta el documento de término. El sistema no
              permite guardar sin ese documento.
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-900">¿Cuál es la diferencia entre “Terminado” y “Terminado – Apelación”?</p>
            <p className="mt-1">
              “Terminado – Apelación” permite continuar el seguimiento del expediente sin cerrarlo completamente.
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-900">¿Dónde gestiono pagos y estados de cobro?</p>
            <p className="mt-1">
              En <Link className="text-sky-700 hover:underline" href="/billing">Cobros</Link> puedes crear un cobro,
              vincularlo a uno o más casos y registrar pagos para mantener el historial y estado.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

