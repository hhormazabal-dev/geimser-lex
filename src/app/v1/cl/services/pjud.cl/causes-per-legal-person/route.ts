import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ojvCausesPerLegalPerson } from '@/lib/pjud/ojv';

export const runtime = 'nodejs';

function requireApiKey(req: Request) {
  const required = process.env.SERVICES_API_KEY?.trim();
  if (!required) return null;
  const provided =
    req.headers.get('x-api-key')?.trim() ||
    req.headers.get('x-api-key'.toUpperCase())?.trim() ||
    '';
  if (provided !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

const requestSchema = z.object({
  RequestData: z.object({
    Rut: z.string().min(1),
    Context: z.string().min(1),
    Court: z.string().min(1).optional(),
    Detail: z.boolean().optional(),
  }),
  CallbackUrl: z.string().url().optional(),
});

type ApiError = {
  Code: string;
  Type: 'RETRY_IMMEDIATELY' | 'DO_NOT_RETRY' | 'WAIT_4_HOURS_BEFORE_RETRY' | 'RETRY_AFTER_NOTIFICATION';
  Description: string;
};

function ok202(operationId: string) {
  const lifeSpan = new Date(Date.now() + 1000 * 60 * 15).toISOString();
  return NextResponse.json(
    {
      OperationId: operationId,
      Status: 'OK',
      Data: null,
      AdditionalInformation: 'Data will be sent to the callback URL.',
      Error: null,
      LifeSpan: lifeSpan,
    },
    { status: 202 },
  );
}

function ok200(operationId: string, causes: any[], additionalInformation: string | null = null) {
  return NextResponse.json(
    {
      OperationId: operationId,
      Status: 'OK',
      Data: { Causes: causes },
      AdditionalInformation: additionalInformation,
      Error: null,
      LifeSpan: null,
    },
    { status: 200 },
  );
}

function err(operationId: string, status: number, error: ApiError) {
  return NextResponse.json(
    {
      OperationId: operationId,
      Status: 'ERROR',
      Data: null,
      AdditionalInformation: null,
      Error: error,
      LifeSpan: null,
    },
    { status },
  );
}

async function processOnce(body: z.infer<typeof requestSchema>) {
  const causes = await ojvCausesPerLegalPerson({
    rut: body.RequestData.Rut,
    contextValue: body.RequestData.Context,
    courtValue: body.RequestData.Court ?? null,
    detail: Boolean(body.RequestData.Detail),
  });

  return causes.map((c) => ({
    AdministrativeStatus: c.administrativeStatus ?? '',
    CauseState: c.causeState ?? '',
    Court: c.court ?? '',
    Date: c.date ?? '',
    Labeled: c.labeled ?? '',
    Litigant: (c.litigants ?? []).map((l) => ({
      Entity: l.entity ?? '',
      IncarcerationStatus: l.incarcerationStatus ?? '',
      Name: l.name ?? '',
      Participant: l.participant ?? '',
      Rut: l.rut ?? '',
      Subject: l.subject ?? '',
      Type: l.type ?? '',
    })),
    Procedure: c.procedure ?? '',
    Resource: c.resource ?? '',
    Role: c.role ?? '',
    Ruc: c.ruc ?? '',
    Ubication: c.ubication ?? '',
    SourceUrl: c.sourceUrl ?? null,
  }));
}

export async function POST(req: Request) {
  const authErr = requireApiKey(req);
  if (authErr) return authErr;

  const operationId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `op_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  try {
    const json = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return err(operationId, 400, {
        Code: 'E400',
        Type: 'DO_NOT_RETRY',
        Description: 'Request inválida. Revisa RequestData y CallbackUrl.',
      });
    }

    const body = parsed.data;

    // Async best-effort: dispara en background y responde 202.
    if (body.CallbackUrl) {
      queueMicrotask(async () => {
        try {
          const causes = await processOnce(body);
          await fetch(body.CallbackUrl!, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              OperationId: operationId,
              Status: 'OK',
              Data: { Causes: causes },
              AdditionalInformation: null,
              Error: null,
              LifeSpan: null,
            }),
          });
        } catch (e: any) {
          await fetch(body.CallbackUrl!, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              OperationId: operationId,
              Status: 'ERROR',
              Data: null,
              AdditionalInformation: null,
              Error: {
                Code: 'E201',
                Type: 'RETRY_AFTER_NOTIFICATION',
                Description: e?.message ?? 'Error ejecutando servicio PJUD.',
              },
              LifeSpan: null,
            }),
          }).catch(() => null);
        }
      });

      return ok202(operationId);
    }

    const causes = await processOnce(body);
    return ok200(operationId, causes, causes.length === 0 ? 'OK: no se encontraron causas.' : null);
  } catch (e: any) {
    return err(operationId, 502, {
      Code: 'E201',
      Type: 'RETRY_IMMEDIATELY',
      Description: e?.message ?? 'El servicio destino utilizado para la extracción de datos no se encuentra disponible.',
    });
  }
}
