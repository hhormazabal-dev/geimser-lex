export type DailyStatementLinkMeta = Record<string, string>;

export type DailyStatementItem = {
  competencia: string;
  numeroIngreso: string;
  partes: string;
  providencias: string;
  linkMeta?: DailyStatementLinkMeta;
};

export type DailyStatementsHistoryMode = 'last' | 'range';

export type DailyStatementsHistoryEntry = {
  date: string;
  items: DailyStatementItem[];
};

export type DailyStatementsHistoryResponse = {
  success: boolean;
  caseId: string;
  mode: DailyStatementsHistoryMode;
  range: { toDate: string; days: number };
  maxAvailableDate: string;
  scannedDays: number;
  failures?: number;
  partial?: boolean;
  nextTo: string | null;
  court: {
    codTribunal: string;
    tipoJuzgado: string;
    nombreTribunal: string;
  };
  matches: DailyStatementsHistoryEntry[];
  durationMs: number;
};

export type DailyStatementsResponse = {
  success: boolean;
  caseId: string;
  dateRequested: string | null;
  /**
   * Última fecha disponible reportada por PJUD (sin forzar registros),
   * usada para limitar navegación "día siguiente".
   */
  maxAvailableDate?: string | null;
  date: string;
  dateResolution?: 'requested' | 'nearest_previous' | 'latest';
  court: {
    codTribunal: string;
    tipoJuzgado: string;
    nombreTribunal: string;
  };
  items: DailyStatementItem[];
  fetchedAt: string;
  cached: boolean;
};
