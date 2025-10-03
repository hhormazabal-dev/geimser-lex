import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeadlineReminder {
  stage_id: string;
  case_id: string;
  case_name: string;
  stage_name: string;
  deadline: string;
  days_remaining: number;
  description?: string;
  lawyer_email: string;
  client_emails: string[];
}

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

    const today = new Date();
    const reminderDays = [7, 3, 1]; // Recordar 7, 3 y 1 día antes

    const reminders: DeadlineReminder[] = [];

    // Buscar etapas que vencen en los próximos días
    for (const days of reminderDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: stages, error } = await supabaseClient
        .from('case_stages')
        .select(`
          id,
          etapa,
          descripcion,
          fecha_programada,
          case_id,
          case:cases(
            caratulado,
            abogado_responsable:profiles(email)
          )
        `)
        .eq('estado', 'pendiente')
        .gte('fecha_programada', startOfDay.toISOString())
        .lte('fecha_programada', endOfDay.toISOString());

      if (error) {
        console.error('Error fetching stages:', error);
        continue;
      }

      for (const stage of stages || []) {
        // Obtener emails de clientes del caso
        const { data: caseClients } = await supabaseClient
          .from('case_clients')
          .select(`
            client_profile_id,
            client_profile:profiles(email)
          `)
          .eq('case_id', stage.case_id);

        const clientEmails = caseClients?.map(cc => cc.client_profile?.email).filter(Boolean) || [];

        // Verificar si ya se envió recordatorio para esta etapa y este número de días
        const { data: existingReminder } = await supabaseClient
          .from('notification_logs')
          .select('id')
          .eq('template', 'deadline_reminder')
          .eq('data->stage_id', stage.id)
          .eq('data->days_remaining', days)
          .gte('sent_at', startOfDay.toISOString())
          .single();

        if (!existingReminder) {
          reminders.push({
            stage_id: stage.id,
            case_id: stage.case_id,
            case_name: stage.case?.caratulado || 'Caso sin nombre',
            stage_name: stage.etapa,
            deadline: stage.fecha_programada,
            days_remaining: days,
            description: stage.descripcion,
            lawyer_email: stage.case?.abogado_responsable?.email || '',
            client_emails: clientEmails,
          });
        }
      }
    }

    console.log(`Found ${reminders.length} deadline reminders to send`);

    // Enviar recordatorios
    const results = [];
    for (const reminder of reminders) {
      const notificationData = {
        case_name: reminder.case_name,
        stage_name: reminder.stage_name,
        deadline: reminder.deadline,
        days_remaining: reminder.days_remaining,
        description: reminder.description,
      };

      // Enviar a abogado
      if (reminder.lawyer_email) {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              type: 'email',
              to: reminder.lawyer_email,
              template: 'deadline_reminder',
              data: {
                ...notificationData,
                stage_id: reminder.stage_id,
              },
            }),
          });

          if (response.ok) {
            results.push({ type: 'lawyer', email: reminder.lawyer_email, status: 'sent' });
          } else {
            results.push({ type: 'lawyer', email: reminder.lawyer_email, status: 'failed' });
          }
        } catch (error) {
          console.error('Error sending lawyer reminder:', error);
          results.push({ type: 'lawyer', email: reminder.lawyer_email, status: 'error' });
        }
      }

      // Enviar a clientes
      for (const clientEmail of reminder.client_emails) {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              type: 'email',
              to: clientEmail,
              template: 'deadline_reminder',
              data: {
                ...notificationData,
                stage_id: reminder.stage_id,
              },
            }),
          });

          if (response.ok) {
            results.push({ type: 'client', email: clientEmail, status: 'sent' });
          } else {
            results.push({ type: 'client', email: clientEmail, status: 'failed' });
          }
        } catch (error) {
          console.error('Error sending client reminder:', error);
          results.push({ type: 'client', email: clientEmail, status: 'error' });
        }
      }
    }

    // Buscar etapas vencidas (para alertas diarias)
    const { data: overdueStages, error: overdueError } = await supabaseClient
      .from('case_stages')
      .select(`
        id,
        etapa,
        fecha_programada,
        case:cases(
          caratulado,
          abogado_responsable:profiles(email)
        )
      `)
      .eq('estado', 'pendiente')
      .lt('fecha_programada', today.toISOString());

    if (!overdueError && overdueStages && overdueStages.length > 0) {
      // Agrupar por abogado
      const overdueByLawyer: Record<string, any[]> = {};
      
      for (const stage of overdueStages) {
        const lawyerEmail = stage.case?.abogado_responsable?.email;
        if (lawyerEmail) {
          if (!overdueByLawyer[lawyerEmail]) {
            overdueByLawyer[lawyerEmail] = [];
          }
          overdueByLawyer[lawyerEmail].push(stage);
        }
      }

      // Enviar resumen de etapas vencidas a cada abogado (máximo una vez por día)
      for (const [lawyerEmail, stages] of Object.entries(overdueByLawyer)) {
        // Verificar si ya se envió alerta hoy
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);

        const { data: existingAlert } = await supabaseClient
          .from('notification_logs')
          .select('id')
          .eq('template', 'overdue_stages_alert')
          .eq('recipient', lawyerEmail)
          .gte('sent_at', startOfToday.toISOString())
          .single();

        if (!existingAlert) {
          try {
            const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              },
              body: JSON.stringify({
                type: 'email',
                to: lawyerEmail,
                template: 'overdue_stages_alert',
                data: {
                  overdue_count: stages.length,
                  stages: stages.map(s => ({
                    case_name: s.case?.caratulado,
                    stage_name: s.etapa,
                    deadline: s.fecha_programada,
                  })),
                },
              }),
            });

            if (response.ok) {
              results.push({ type: 'overdue_alert', email: lawyerEmail, status: 'sent' });
            }
          } catch (error) {
            console.error('Error sending overdue alert:', error);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily reminders processed',
        reminders_found: reminders.length,
        overdue_stages: overdueStages?.length || 0,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing daily reminders:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
