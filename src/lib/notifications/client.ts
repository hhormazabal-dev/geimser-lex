export type NotificationResponse = { ok: boolean };

export const notificationClient = {
  async sendEmail(_to: string, _subject: string, _html: string): Promise<NotificationResponse> {
    return { ok: true };
  },

  // La UI espera { success, logs, error }
  async getNotificationLogs(_args: any): Promise<{ success: boolean; logs: any[]; error?: string }> {
    return { success: true, logs: [] };
  },

  // La UI espera { success, stats, error }
  async getNotificationStats(_period: any): Promise<{ success: boolean; stats: any; error?: string }> {
    return { success: true, stats: null };
  },
};
