/* MAGICLINK TEMPORALMENTE DESHABILITADO */
/*
import nodemailer from 'nodemailer';

  to: string;
  url: string;
  caseName: string;
}

interface StageNotificationPayload {
  case_id: string;
  stage_id: string;
  etapa: string;
  case?: { caratulado?: string; nombre_cliente?: string };
  recipients?: string[];
}

interface RequestReminderPayload {
  info_request_id: string;
  case_id: string;
  descripcion: string;
  fecha_limite?: string;
  recipients: string[];
}

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('[mailer] SMTP no configurado, se omite envío real.');
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

  const transport = getTransport();

  if (!transport) {
    console.info('[mailer] Magic link email simulado para', payload.to, payload.url);
    return;
  }

  await transport.sendMail({
    to: payload.to,
    subject: 'Acceso al portal cliente - LEXSER',
    html: `
      <p>Hola,</p>
      <p>Tu enlace de acceso al portal cliente es:</p>
      <p><a href="${payload.url}">${payload.url}</a></p>
      <p>Caso: <strong>${payload.caseName}</strong></p>
      <p>Este enlace expira automáticamente. No lo compartas.</p>
    `,
  });
}

export async function sendStageNotification(payload: StageNotificationPayload) {
  const transport = getTransport();
  const recipients = payload.recipients ?? [];

  if (!transport || recipients.length === 0) {
    console.info('[mailer] Notificación de etapa simulada', payload);
    return;
  }

  await transport.sendMail({
    to: recipients,
    subject: `Actualización de etapa: ${payload.etapa}`,
    html: `
      <p>Se ha actualizado la etapa <strong>${payload.etapa}</strong> del caso ${payload.case?.caratulado ?? ''}.</p>
      <p>Ingresa al portal para revisar los detalles.</p>
    `,
  });
}

export async function sendRequestReminder(payload: RequestReminderPayload) {
  const transport = getTransport();

  if (!transport || payload.recipients.length === 0) {
    console.info('[mailer] Recordatorio de solicitud simulada', payload);
    return;
  }

  await transport.sendMail({
    to: payload.recipients,
    subject: 'Recordatorio de solicitud pendiente',
    html: `
      <p>Recordatorio: ${payload.descripcion}</p>
      <p>Fecha límite: ${payload.fecha_limite ?? 'Sin fecha informada'}</p>
    `,
  });
}
*/
export {};
