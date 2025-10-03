import { createClient } from '@/lib/supabase/client';

export interface NotificationRequest {
  type: 'email' | 'sms';
  to: string;
  template: string;
  data: Record<string, any>;
}

export interface NotificationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Cliente para enviar notificaciones usando Edge Functions
 */
export class NotificationClient {
  private supabase = createClient();

  /**
   * Envía una notificación usando la Edge Function
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResponse> {
    try {
      const { data, error } = await this.supabase.functions.invoke('send-notification', {
        body: request,
      });

      if (error) {
        console.error('Error invoking notification function:', error);
        return {
          success: false,
          error: error.message || 'Error al enviar notificación',
        };
      }

      return data;
    } catch (error) {
      console.error('Error sending notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Envía un magic link por email
   */
  async sendMagicLinkEmail(
    email: string,
    magicLink: string,
    caseData: {
      name: string;
      lawyerName: string;
      expiresAt: string;
    }
  ): Promise<NotificationResponse> {
    return this.sendNotification({
      type: 'email',
      to: email,
      template: 'magic_link',
      data: {
        magic_link: magicLink,
        case_name: caseData.name,
        lawyer_name: caseData.lawyerName,
        expires_at: caseData.expiresAt,
      },
    });
  }

  /**
   * Envía notificación de actualización de caso
   */
  async sendCaseUpdateNotification(
    email: string,
    updateData: {
      caseName: string;
      updateType: string;
      description: string;
      stageName?: string;
      date: string;
    }
  ): Promise<NotificationResponse> {
    return this.sendNotification({
      type: 'email',
      to: email,
      template: 'case_update',
      data: {
        case_name: updateData.caseName,
        update_type: updateData.updateType,
        description: updateData.description,
        stage_name: updateData.stageName,
        date: updateData.date,
      },
    });
  }

  /**
   * Envía recordatorio de vencimiento
   */
  async sendDeadlineReminder(
    email: string,
    reminderData: {
      caseName: string;
      stageName: string;
      deadline: string;
      daysRemaining: number;
      description?: string;
    }
  ): Promise<NotificationResponse> {
    return this.sendNotification({
      type: 'email',
      to: email,
      template: 'deadline_reminder',
      data: {
        case_name: reminderData.caseName,
        stage_name: reminderData.stageName,
        deadline: reminderData.deadline,
        days_remaining: reminderData.daysRemaining,
        description: reminderData.description,
      },
    });
  }

  /**
   * Envía notificación de respuesta a solicitud de información
   */
  async sendInfoRequestResponse(
    email: string,
    responseData: {
      requestTitle: string;
      requestDescription: string;
      response: string;
      responderName: string;
      responseDate: string;
    }
  ): Promise<NotificationResponse> {
    return this.sendNotification({
      type: 'email',
      to: email,
      template: 'info_request_response',
      data: {
        request_title: responseData.requestTitle,
        request_description: responseData.requestDescription,
        response: responseData.response,
        responder_name: responseData.responderName,
        response_date: responseData.responseDate,
      },
    });
  }

  /**
   * Obtiene el historial de notificaciones (solo para admin)
   */
  async getNotificationLogs(filters?: {
    type?: string;
    recipient?: string;
    template?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = this.supabase
        .from('notification_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.recipient) {
        query = query.ilike('recipient', `%${filters.recipient}%`);
      }

      if (filters?.template) {
        query = query.eq('template', filters.template);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return {
        success: true,
        logs: data || [],
      };
    } catch (error) {
      console.error('Error fetching notification logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        logs: [],
      };
    }
  }

  /**
   * Obtiene estadísticas de notificaciones
   */
  async getNotificationStats(period: 'day' | 'week' | 'month' = 'week') {
    try {
      const now = new Date();
      const startDate = new Date();

      switch (period) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      const { data, error } = await this.supabase
        .from('notification_logs')
        .select('type, status, template')
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      const logs = data || [];
      const stats = {
        total: logs.length,
        byType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        byTemplate: {} as Record<string, number>,
        successRate: 0,
      };

      logs.forEach(log => {
        // Por tipo
        stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
        
        // Por estado
        stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
        
        // Por plantilla
        stats.byTemplate[log.template] = (stats.byTemplate[log.template] || 0) + 1;
      });

      // Calcular tasa de éxito
      const sentCount = stats.byStatus['sent'] || 0;
      stats.successRate = stats.total > 0 ? Math.round((sentCount / stats.total) * 100) : 0;

      return {
        success: true,
        stats,
        period,
      };
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

// Instancia singleton del cliente de notificaciones
export const notificationClient = new NotificationClient();
