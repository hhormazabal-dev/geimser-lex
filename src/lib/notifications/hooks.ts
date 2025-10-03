'use server';

import { createClient } from '@/lib/supabase/server';
import { notificationClient } from './client';

/**
 * Hook que se ejecuta cuando se crea un magic link
 */
export async function onMagicLinkCreated(magicLinkId: string) {
  try {
    const supabase = createClient();

    // Obtener datos del magic link
    const { data: magicLink, error } = await supabase
      .from('magic_links')
      .select(`
        *,
        case:cases(
          caratulado,
          abogado_responsable:profiles(nombre)
        )
      `)
      .eq('id', magicLinkId)
      .single();

    if (error || !magicLink) {
      console.error('Error fetching magic link:', error);
      return;
    }

    // Construir URL del magic link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLinkUrl = `${baseUrl}/client-access?token=${magicLink.token}`;

    // Enviar email
    await notificationClient.sendMagicLinkEmail(
      magicLink.email,
      magicLinkUrl,
      {
        name: magicLink.case?.caratulado || 'Caso sin nombre',
        lawyerName: magicLink.case?.abogado_responsable?.nombre || 'Abogado',
        expiresAt: magicLink.expires_at,
      }
    );

    console.log(`Magic link email sent to ${magicLink.email}`);
  } catch (error) {
    console.error('Error in onMagicLinkCreated hook:', error);
  }
}

/**
 * Hook que se ejecuta cuando se completa una etapa
 */
export async function onStageCompleted(stageId: string) {
  try {
    const supabase = createClient();

    // Obtener datos de la etapa
    const { data: stage, error } = await supabase
      .from('case_stages')
      .select(`
        *,
        case:cases(
          caratulado,
          abogado_responsable:profiles(nombre, email)
        )
      `)
      .eq('id', stageId)
      .single();

    if (error || !stage) {
      console.error('Error fetching stage:', error);
      return;
    }

    // Obtener clientes del caso
    const { data: caseClients } = await supabase
      .from('case_clients')
      .select(`
        client_profile:profiles(email, nombre)
      `)
      .eq('case_id', stage.case_id);

    const clientEmails = caseClients?.map(cc => cc.client_profile?.email).filter(Boolean) || [];

    // Enviar notificaciones a clientes
    for (const email of clientEmails) {
      await notificationClient.sendCaseUpdateNotification(
        email,
        {
          caseName: stage.case?.caratulado || 'Caso sin nombre',
          updateType: 'Etapa Completada',
          description: `Se ha completado la etapa "${stage.etapa}"`,
          stageName: stage.etapa,
          date: stage.fecha_completada || new Date().toISOString(),
        }
      );
    }

    console.log(`Stage completion notifications sent for stage ${stageId}`);
  } catch (error) {
    console.error('Error in onStageCompleted hook:', error);
  }
}

/**
 * Hook que se ejecuta cuando se responde una solicitud de información
 */
export async function onInfoRequestResponded(requestId: string) {
  try {
    const supabase = createClient();

    // Obtener datos de la solicitud
    const { data: request, error } = await supabase
      .from('info_requests')
      .select(`
        *,
        creador:profiles(email, nombre),
        respondido_por_profile:profiles(nombre),
        case:cases(caratulado)
      `)
      .eq('id', requestId)
      .single();

    if (error || !request) {
      console.error('Error fetching info request:', error);
      return;
    }

    // Solo enviar si hay un creador con email
    if (request.creador?.email) {
      await notificationClient.sendInfoRequestResponse(
        request.creador.email,
        {
          requestTitle: request.titulo,
          requestDescription: request.descripcion,
          response: request.respuesta || '',
          responderName: request.respondido_por_profile?.nombre || 'Abogado',
          responseDate: request.fecha_respuesta || new Date().toISOString(),
        }
      );

      console.log(`Info request response notification sent to ${request.creador.email}`);
    }
  } catch (error) {
    console.error('Error in onInfoRequestResponded hook:', error);
  }
}

/**
 * Hook que se ejecuta cuando se crea un nuevo caso
 */
export async function onCaseCreated(caseId: string) {
  try {
    const supabase = createClient();

    // Obtener datos del caso
    const { data: case_, error } = await supabase
      .from('cases')
      .select(`
        *,
        abogado_responsable:profiles(email, nombre)
      `)
      .eq('id', caseId)
      .single();

    if (error || !case_) {
      console.error('Error fetching case:', error);
      return;
    }

    // Obtener clientes del caso (si ya están asociados)
    const { data: caseClients } = await supabase
      .from('case_clients')
      .select(`
        client_profile:profiles(email, nombre)
      `)
      .eq('case_id', caseId);

    const clientEmails = caseClients?.map(cc => cc.client_profile?.email).filter(Boolean) || [];

    // Enviar notificaciones a clientes
    for (const email of clientEmails) {
      await notificationClient.sendCaseUpdateNotification(
        email,
        {
          caseName: case_.caratulado,
          updateType: 'Nuevo Caso',
          description: `Se ha creado un nuevo caso: ${case_.caratulado}`,
          date: case_.created_at || new Date().toISOString(),
        }
      );
    }

    console.log(`Case creation notifications sent for case ${caseId}`);
  } catch (error) {
    console.error('Error in onCaseCreated hook:', error);
  }
}

/**
 * Hook que se ejecuta cuando se sube un nuevo documento
 */
export async function onDocumentUploaded(documentId: string) {
  try {
    const supabase = createClient();

    // Obtener datos del documento
    const { data: document, error } = await supabase
      .from('case_documents')
      .select(`
        *,
        case:cases(
          caratulado,
          abogado_responsable:profiles(nombre)
        ),
        uploaded_by:profiles(nombre)
      `)
      .eq('id', documentId)
      .single();

    if (error || !document) {
      console.error('Error fetching document:', error);
      return;
    }

    // Solo notificar si el documento es visible para clientes
    if (!document.visible_cliente) {
      return;
    }

    // Obtener clientes del caso
    const { data: caseClients } = await supabase
      .from('case_clients')
      .select(`
        client_profile:profiles(email, nombre)
      `)
      .eq('case_id', document.case_id);

    const clientEmails = caseClients?.map(cc => cc.client_profile?.email).filter(Boolean) || [];

    // Enviar notificaciones a clientes
    for (const email of clientEmails) {
      await notificationClient.sendCaseUpdateNotification(
        email,
        {
          caseName: document.case?.caratulado || 'Caso sin nombre',
          updateType: 'Nuevo Documento',
          description: `Se ha agregado un nuevo documento: ${document.nombre}`,
          date: document.created_at || new Date().toISOString(),
        }
      );
    }

    console.log(`Document upload notifications sent for document ${documentId}`);
  } catch (error) {
    console.error('Error in onDocumentUploaded hook:', error);
  }
}

/**
 * Función para ejecutar recordatorios diarios (llamada por cron job)
 */
export async function runDailyReminders() {
  try {
    const supabase = createClient();

    // Invocar la Edge Function de recordatorios diarios
    const { data, error } = await supabase.functions.invoke('daily-reminders');

    if (error) {
      console.error('Error invoking daily reminders function:', error);
      return { success: false, error: error.message };
    }

    console.log('Daily reminders executed successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error running daily reminders:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Función para enviar resumen semanal a abogados
 */
export async function sendWeeklySummary() {
  try {
    const supabase = createClient();

    // Obtener todos los abogados
    const { data: lawyers, error: lawyersError } = await supabase
      .from('profiles')
      .select('id, nombre, email')
      .in('role', ['abogado', 'admin_firma']);

    if (lawyersError) {
      console.error('Error fetching lawyers:', lawyersError);
      return { success: false, error: lawyersError.message };
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const lawyer of lawyers || []) {
      // Obtener estadísticas de la semana para este abogado
      const [casesResult, stagesResult, requestsResult] = await Promise.all([
        supabase
          .from('cases')
          .select('id, caratulado, estado')
          .eq('abogado_responsable', lawyer.id)
          .gte('created_at', oneWeekAgo.toISOString()),
        supabase
          .from('case_stages')
          .select('id, etapa, estado, case:cases(caratulado)')
          .eq('estado', 'completada')
          .gte('fecha_completada', oneWeekAgo.toISOString())
          .in('case_id', 
            supabase
              .from('cases')
              .select('id')
              .eq('abogado_responsable', lawyer.id)
          ),
        supabase
          .from('info_requests')
          .select('id, titulo, estado')
          .eq('estado', 'pendiente')
          .in('case_id',
            supabase
              .from('cases')
              .select('id')
              .eq('abogado_responsable', lawyer.id)
          )
      ]);

      const newCases = casesResult.data || [];
      const completedStages = stagesResult.data || [];
      const pendingRequests = requestsResult.data || [];

      // Solo enviar si hay actividad o elementos pendientes
      if (newCases.length > 0 || completedStages.length > 0 || pendingRequests.length > 0) {
        await notificationClient.sendNotification({
          type: 'email',
          to: lawyer.email,
          template: 'weekly_summary',
          data: {
            lawyer_name: lawyer.nombre,
            new_cases: newCases,
            completed_stages: completedStages,
            pending_requests: pendingRequests,
            week_start: oneWeekAgo.toISOString(),
            week_end: new Date().toISOString(),
          },
        });
      }
    }

    console.log('Weekly summaries sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending weekly summary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}
