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
  organization_id: string;
  deadline: string;
  days_remaining: number;
  description?: string;
  lawyer_email: string;
  client_emails: string[];
}

type OrgNotificationSettings = {
  organization_id: string;
  deadline_emails_enabled: boolean;
  calendar_links_enabled: boolean;
  deadline_reminder_days: number[];
  deadline_send_to_lawyer: boolean;
  deadline_send_to_staff: boolean;
  deadline_send_to_clients: boolean;
};

function defaultSettings(orgId: string): OrgNotificationSettings {
  return {
    organization_id: orgId,
    deadline_emails_enabled: true,
    calendar_links_enabled: true,
    deadline_reminder_days: [7, 3, 1],
    deadline_send_to_lawyer: true,
    deadline_send_to_staff: false,
    deadline_send_to_clients: true,
  };
}

function encodeQuery(params: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, v);
  return qs.toString();
}

function toGoogleDateRange(dateOnly: string) {
  const start = dateOnly.replaceAll('-', '');
  const endDate = new Date(`${dateOnly}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = `${endDate.getUTCFullYear()}${String(endDate.getUTCMonth() + 1).padStart(2, '0')}${String(endDate.getUTCDate()).padStart(2, '0')}`;
  return `${start}/${end}`;
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
    const appUrl =
      Deno.env.get('APP_URL') ??
      Deno.env.get('NEXT_PUBLIC_APP_URL') ??
      'https://geimser-lex.vercel.app';

    const { data: settingsRows } = await supabaseClient
      .from('organization_notification_settings')
      .select(
        'organization_id, deadline_emails_enabled, calendar_links_enabled, deadline_reminder_days, deadline_send_to_lawyer, deadline_send_to_staff, deadline_send_to_clients'
      );

    const settingsByOrg = new Map<string, OrgNotificationSettings>(
      (settingsRows ?? []).map((r: any) => [
        String(r.organization_id),
        {
          organization_id: String(r.organization_id),
          deadline_emails_enabled: Boolean(r.deadline_emails_enabled),
          calendar_links_enabled: Boolean(r.calendar_links_enabled),
          deadline_reminder_days: Array.isArray(r.deadline_reminder_days)
            ? r.deadline_reminder_days.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
            : [7, 3, 1],
          deadline_send_to_lawyer: Boolean(r.deadline_send_to_lawyer),
          deadline_send_to_staff: Boolean(r.deadline_send_to_staff),
          deadline_send_to_clients: Boolean(r.deadline_send_to_clients),
        } satisfies OrgNotificationSettings,
      ])
    );

    const unionDaysSet = new Set<number>();
    for (const s of settingsByOrg.values()) {
      if (!s.deadline_emails_enabled) continue;
      for (const d of s.deadline_reminder_days ?? []) {
        const day = Number(d);
        if (Number.isFinite(day) && day > 0 && day <= 365) unionDaysSet.add(day);
      }
    }
    const reminderDays = Array.from(unionDaysSet);
    if (reminderDays.length === 0) reminderDays.push(7, 3, 1);

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
          organization_id,
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
        const orgId = String(stage.organization_id ?? '');
        const settings = orgId ? settingsByOrg.get(orgId) ?? defaultSettings(orgId) : defaultSettings('unknown');
        if (!settings.deadline_emails_enabled) continue;
        if (settings.deadline_reminder_days && !settings.deadline_reminder_days.includes(days)) continue;

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
          .eq('data->>stage_id', stage.id)
          .eq('data->>days_remaining', String(days))
          .gte('sent_at', startOfDay.toISOString())
          .maybeSingle();

        if (!existingReminder) {
          reminders.push({
            stage_id: stage.id,
            case_id: stage.case_id,
            case_name: stage.case?.caratulado || 'Caso sin nombre',
            stage_name: stage.etapa,
            organization_id: String(stage.organization_id),
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
      const orgId = reminder.organization_id;
      const settings = orgId ? settingsByOrg.get(orgId) ?? defaultSettings(orgId) : defaultSettings('unknown');

      const notificationData = {
        case_name: reminder.case_name,
        stage_name: reminder.stage_name,
        deadline: reminder.deadline,
        days_remaining: reminder.days_remaining,
        description: reminder.description,
        case_url: `${appUrl}/cases/${reminder.case_id}`,
      };

      async function buildCalendar(reminderEmail: string) {
        if (!settings.calendar_links_enabled) return null;
        const dateOnly = String(reminder.deadline ?? '').trim();
        if (!dateOnly) return null;
        const token = crypto.randomUUID();
        const { error: tokErr } = await supabaseClient.from('calendar_event_tokens').insert({
          token,
          organization_id: orgId,
          stage_id: reminder.stage_id,
          recipient_email: reminderEmail,
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
        });
        if (tokErr) {
          console.error('Error inserting calendar token:', tokErr);
          return null;
        }

        const text = `${reminder.case_name} · ${reminder.stage_name}`;
        const details = `${reminder.description ? `${reminder.description}\n\n` : ''}Ver caso: ${notificationData.case_url}`;
        const googleUrl = `https://calendar.google.com/calendar/render?${encodeQuery({
          action: 'TEMPLATE',
          text,
          dates: toGoogleDateRange(dateOnly),
          details,
        })}`;
        const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${encodeQuery({
          subject: text,
          startdt: `${dateOnly}T00:00:00Z`,
          enddt: `${dateOnly}T23:59:59Z`,
          body: details,
        })}`;
        return {
          ics_url: `${appUrl}/api/calendar/ics?token=${encodeURIComponent(token)}`,
          google_url: googleUrl,
          outlook_url: outlookUrl,
        };
      }

      // Enviar a abogado
      if (settings.deadline_send_to_lawyer && reminder.lawyer_email) {
        try {
          const calendar = await buildCalendar(reminder.lawyer_email);
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
                calendar,
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

      // Enviar a equipo interno (org_admin/staff)
      if (settings.deadline_send_to_staff) {
        try {
          const { data: members } = await supabaseClient
            .from('org_members')
            .select('user_id, role')
            .eq('organization_id', orgId)
            .in('role', ['org_admin', 'staff']);
          const ids = Array.from(new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean)));
          if (ids.length) {
            const { data: staffProfiles } = await supabaseClient.from('profiles').select('email, user_id').in('user_id', ids);
            const staffEmails = Array.from(new Set((staffProfiles ?? []).map((p: any) => p.email).filter(Boolean)));
            for (const staffEmail of staffEmails) {
              const calendar = await buildCalendar(staffEmail);
              const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                },
                body: JSON.stringify({
                  type: 'email',
                  to: staffEmail,
                  template: 'deadline_reminder',
                  data: {
                    ...notificationData,
                    stage_id: reminder.stage_id,
                    calendar,
                  },
                }),
              });
              if (response.ok) {
                results.push({ type: 'staff', email: staffEmail, status: 'sent' });
              } else {
                results.push({ type: 'staff', email: staffEmail, status: 'failed' });
              }
            }
          }
        } catch (error) {
          console.error('Error sending staff reminders:', error);
        }
      }

      // Enviar a clientes
      if (settings.deadline_send_to_clients) for (const clientEmail of reminder.client_emails) {
        try {
          const calendar = await buildCalendar(clientEmail);
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
                calendar,
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
                  dashboard_url: `${appUrl}/inbox`,
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
