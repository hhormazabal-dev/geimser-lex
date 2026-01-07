import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'email' | 'sms';
  to: string;
  subject?: string;
  template: string;
  data: Record<string, any>;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function calendarHtmlBlock(data: any): string {
  const c = data?.calendar;
  if (!c || (!c.ics_url && !c.google_url && !c.outlook_url)) return '';
  return `
    <div style="margin: 18px 0; padding: 16px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px;">
      <p style="margin: 0 0 10px 0; font-weight: 700;">📅 Agregar al calendario</p>
      <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">Un clic y queda en tu agenda (ICS / Google / Outlook).</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${c.ics_url ? `<a href="${c.ics_url}" style="display:inline-block; background:#111827; color:#fff; padding:10px 14px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">Descargar .ics</a>` : ''}
        ${c.google_url ? `<a href="${c.google_url}" style="display:inline-block; background:#2563eb; color:#fff; padding:10px 14px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">Google Calendar</a>` : ''}
        ${c.outlook_url ? `<a href="${c.outlook_url}" style="display:inline-block; background:#0f766e; color:#fff; padding:10px 14px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">Outlook</a>` : ''}
      </div>
    </div>
  `;
}

function calendarTextBlock(data: any): string {
  const c = data?.calendar;
  if (!c || (!c.ics_url && !c.google_url && !c.outlook_url)) return '';
  return `
Agregar al calendario:
${c.ics_url ? `- ICS: ${c.ics_url}` : ''}
${c.google_url ? `- Google: ${c.google_url}` : ''}
${c.outlook_url ? `- Outlook: ${c.outlook_url}` : ''}
`.trim();
}

const EMAIL_TEMPLATES: Record<string, (data: any) => EmailTemplate> = {
  magic_link: (data) => ({
    subject: `Acceso a tu caso en Xel Chile - ${data.case_name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Acceso a Xel Chile</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f9fafb; }
            .button { 
              display: inline-block; 
              background: #1e40af; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ Xel Chile</h1>
              <p>Portal Cliente</p>
            </div>
            <div class="content">
              <h2>Acceso a tu caso: ${data.case_name}</h2>
              <p>Hola,</p>
              <p>Tu abogado te ha dado acceso al portal cliente de Xel Chile para que puedas seguir el progreso de tu caso.</p>
              
              <p><strong>Caso:</strong> ${data.case_name}</p>
              <p><strong>Abogado:</strong> ${data.lawyer_name}</p>
              
              <p>Haz clic en el siguiente enlace para acceder:</p>
              <a href="${data.magic_link}" class="button">Acceder al Portal</a>
              
              <p><small>Este enlace expira el ${new Date(data.expires_at).toLocaleDateString('es-CL')}.</small></p>
              
              <p>En el portal podrás:</p>
              <ul>
                <li>Ver el progreso de tu caso</li>
                <li>Descargar documentos</li>
                <li>Crear solicitudes de información</li>
                <li>Comunicarte con tu abogado</li>
              </ul>
              
              <p>Si tienes alguna pregunta, no dudes en contactar a tu abogado.</p>
            </div>
            <div class="footer">
              <p>Xel Chile - Sistema de Gestión Legal</p>
              <p>Este es un mensaje automático, por favor no respondas a este email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Xel Chile - Acceso a tu caso
      
      Hola,
      
      Tu abogado te ha dado acceso al portal cliente de Xel Chile para seguir el progreso de tu caso.
      
      Caso: ${data.case_name}
      Abogado: ${data.lawyer_name}
      
      Accede aquí: ${data.magic_link}
      
      Este enlace expira el ${new Date(data.expires_at).toLocaleDateString('es-CL')}.
      
      En el portal podrás ver el progreso, descargar documentos y comunicarte con tu abogado.
      
      Xel Chile - Sistema de Gestión Legal
    `
  }),

  case_update: (data) => ({
    subject: `Actualización en tu caso: ${data.case_name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Actualización de Caso</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f9fafb; }
            .update-box { background: white; padding: 20px; border-left: 4px solid #059669; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ Xel Chile</h1>
              <p>Actualización de Caso</p>
            </div>
            <div class="content">
              <h2>Hay novedades en tu caso</h2>
              <p>Hola,</p>
              <p>Te informamos que hay una actualización en tu caso:</p>
              
              <div class="update-box">
                <h3>${data.case_name}</h3>
                <p><strong>Tipo de actualización:</strong> ${data.update_type}</p>
                <p><strong>Descripción:</strong> ${data.description}</p>
                ${data.stage_name ? `<p><strong>Etapa:</strong> ${data.stage_name}</p>` : ''}
                <p><strong>Fecha:</strong> ${new Date(data.date).toLocaleDateString('es-CL')}</p>
              </div>
              
              ${data.case_url ? `<p><a href="${data.case_url}" style="color:#059669; font-weight:600;">Ver detalles en LEX</a></p>` : '<p>Puedes ver más detalles accediendo al portal.</p>'}
              ${calendarHtmlBlock(data)}
              
              <p>Saludos,<br>Tu equipo legal en Xel Chile</p>
            </div>
            <div class="footer">
              <p>Xel Chile - Sistema de Gestión Legal</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Xel Chile - Actualización de Caso
      
      Hola,
      
      Hay una actualización en tu caso: ${data.case_name}
      
      Tipo: ${data.update_type}
      Descripción: ${data.description}
      ${data.stage_name ? `Etapa: ${data.stage_name}` : ''}
      Fecha: ${new Date(data.date).toLocaleDateString('es-CL')}
      
      ${data.case_url ? `Ver detalles: ${data.case_url}` : 'Puedes ver más detalles en el portal.'}
      
      ${calendarTextBlock(data)}
      
      Saludos,
      Tu equipo legal en Xel Chile
    `
  }),

  deadline_reminder: (data) => ({
    subject: `Recordatorio: Próximo vencimiento en ${data.case_name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recordatorio de Vencimiento</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f9fafb; }
            .alert-box { background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ Xel Chile</h1>
              <p>Recordatorio de Vencimiento</p>
            </div>
            <div class="content">
              <h2>⏰ Próximo vencimiento</h2>
              <p>Estimado/a,</p>
              <p>Te recordamos que se acerca un vencimiento importante en tu caso:</p>
              
              <div class="alert-box">
                <h3>${data.case_name}</h3>
                <p><strong>Etapa:</strong> ${data.stage_name}</p>
                <p><strong>Fecha límite:</strong> ${new Date(data.deadline).toLocaleDateString('es-CL')}</p>
                <p><strong>Días restantes:</strong> ${data.days_remaining}</p>
                ${data.description ? `<p><strong>Descripción:</strong> ${data.description}</p>` : ''}
              </div>
              
              ${data.case_url ? `<p><a href="${data.case_url}" style="color:#dc2626; font-weight:600;">Ver caso en LEX</a></p>` : ''}
              ${calendarHtmlBlock(data)}
              <p>Es importante que estés al tanto de este vencimiento. Si tienes alguna pregunta, contacta a tu abogado.</p>
              
              <p>Saludos,<br>Tu equipo legal en Xel Chile</p>
            </div>
            <div class="footer">
              <p>Xel Chile - Sistema de Gestión Legal</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Xel Chile - Recordatorio de Vencimiento
      
      Estimado/a,
      
      Se acerca un vencimiento importante en tu caso:
      
      Caso: ${data.case_name}
      Etapa: ${data.stage_name}
      Fecha límite: ${new Date(data.deadline).toLocaleDateString('es-CL')}
      Días restantes: ${data.days_remaining}
      ${data.description ? `Descripción: ${data.description}` : ''}
      ${data.case_url ? `Ver caso: ${data.case_url}` : ''}
      
      ${calendarTextBlock(data)}
      
      Contacta a tu abogado si tienes alguna pregunta.
      
      Saludos,
      Tu equipo legal en Xel Chile
    `
  }),

  info_request_response: (data) => ({
    subject: `Respuesta a tu solicitud: ${data.request_title}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Respuesta a Solicitud</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f9fafb; }
            .response-box { background: white; padding: 20px; border-left: 4px solid #7c3aed; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ Xel Chile</h1>
              <p>Respuesta a tu Solicitud</p>
            </div>
            <div class="content">
              <h2>Tu solicitud ha sido respondida</h2>
              <p>Hola,</p>
              <p>Tu abogado ha respondido a tu solicitud de información:</p>
              
              <div class="response-box">
                <h3>${data.request_title}</h3>
                <p><strong>Tu solicitud:</strong> ${data.request_description}</p>
                <hr style="margin: 15px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p><strong>Respuesta:</strong></p>
                <p>${data.response}</p>
                <p><strong>Respondido por:</strong> ${data.responder_name}</p>
                <p><strong>Fecha:</strong> ${new Date(data.response_date).toLocaleDateString('es-CL')}</p>
              </div>
              
              <p>Puedes ver la respuesta completa en el portal cliente.</p>
              
              <p>Saludos,<br>Tu equipo legal en Xel Chile</p>
            </div>
            <div class="footer">
              <p>Xel Chile - Sistema de Gestión Legal</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Xel Chile - Respuesta a tu Solicitud
      
      Hola,
      
      Tu abogado ha respondido a tu solicitud: ${data.request_title}
      
      Tu solicitud: ${data.request_description}
      
      Respuesta: ${data.response}
      
      Respondido por: ${data.responder_name}
      Fecha: ${new Date(data.response_date).toLocaleDateString('es-CL')}
      
      Puedes ver la respuesta completa en el portal cliente.
      
      Saludos,
      Tu equipo legal en Xel Chile
    `
  })
  ,
  overdue_stages_alert: (data) => ({
    subject: `Alerta: ${data.overdue_count ?? 0} etapa(s) vencida(s)`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Etapas Vencidas</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0f172a; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f9fafb; }
            .item { background: white; padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 10px; margin: 10px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ Xel Chile</h1>
              <p>Etapas vencidas</p>
            </div>
            <div class="content">
              <h2>🚨 Tienes etapas vencidas</h2>
              <p>Resumen diario de etapas pendientes con fecha pasada.</p>
              ${(Array.isArray(data.stages) ? data.stages : []).map((s: any) => `
                <div class="item">
                  <p style="margin:0; font-weight:700;">${s.case_name ?? 'Caso'}</p>
                  <p style="margin:6px 0 0 0;"><strong>Etapa:</strong> ${s.stage_name ?? '-'}</p>
                  <p style="margin:6px 0 0 0;"><strong>Fecha:</strong> ${s.deadline ? new Date(s.deadline).toLocaleDateString('es-CL') : '-'}</p>
                </div>
              `).join('')}
              ${data.dashboard_url ? `<p style="margin-top:16px;"><a href="${data.dashboard_url}" style="color:#0f172a; font-weight:700;">Abrir bandeja</a></p>` : ''}
              <p>Saludos,<br>LEX</p>
            </div>
            <div class="footer">
              <p>Xel Chile - Sistema de Gestión Legal</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Alerta de etapas vencidas

Tienes ${data.overdue_count ?? 0} etapa(s) vencida(s).
${Array.isArray(data.stages) ? data.stages.map((s: any) => `- ${s.case_name ?? 'Caso'} · ${s.stage_name ?? '-'} · ${s.deadline ? new Date(s.deadline).toLocaleDateString('es-CL') : '-'}`).join('\n') : ''}
${data.dashboard_url ? `\nAbrir bandeja: ${data.dashboard_url}` : ''}
    `.trim(),
  }),
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, to, template, data }: NotificationRequest = await req.json();

    if (type === 'email') {
      const emailTemplate = EMAIL_TEMPLATES[template];
      if (!emailTemplate) {
        throw new Error(`Template '${template}' not found`);
      }

      const { subject, html, text } = emailTemplate(data);

      // En un entorno real, aquí integrarías con un servicio de email como:
      // - SendGrid
      // - Mailgun
      // - Amazon SES
      // - Resend
      
      // Por ahora, simulamos el envío y guardamos en la base de datos
      const { error: logError } = await supabaseClient
        .from('notification_logs')
        .insert({
          type: 'email',
          recipient: to,
          subject,
          template,
          data,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

      if (logError) {
        console.error('Error logging notification:', logError);
      }

      // Simular envío exitoso
      console.log(`Email sent to ${to} with template ${template}`);
      console.log(`Subject: ${subject}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email sent successfully',
          recipient: to,
          template,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (type === 'sms') {
      // Implementar envío de SMS aquí
      // Servicios como Twilio, AWS SNS, etc.
      
      const { error: logError } = await supabaseClient
        .from('notification_logs')
        .insert({
          type: 'sms',
          recipient: to,
          template,
          data,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

      if (logError) {
        console.error('Error logging notification:', logError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'SMS sent successfully',
          recipient: to,
          template,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    throw new Error(`Unsupported notification type: ${type}`);

  } catch (error) {
    console.error('Error sending notification:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
