export type DailyStatementLinkMeta = Record<string, string>;

export type DailyStatementItem = {
  competencia: string;
  numeroIngreso: string;
  partes: string;
  providencias: string;
  linkMeta?: DailyStatementLinkMeta;
};

export type DailyStatementsResponse = {
  success: boolean;
  caseId: string;
  dateRequested: string | null;
  date: string;
  court: {
    codTribunal: string;
    tipoJuzgado: string;
    nombreTribunal: string;
  };
  items: DailyStatementItem[];
  fetchedAt: string;
  cached: boolean;
};

