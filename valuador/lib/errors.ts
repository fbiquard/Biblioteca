// Errores tipados del scraping/análisis. Cada uno mapea a un mensaje claro
// para el usuario (ver `userMessage`) y a un código HTTP en el route handler.

export type AnalysisErrorCode =
  | 'INVALID_URL' // la URL no es de un portal soportado o está mal formada
  | 'UNSUPPORTED_PORTAL' // portal no soportado
  | 'PROPERTY_NOT_FOUND' // la publicación no existe / fue dada de baja
  | 'BLOCKED' // el portal bloqueó el scraping (anti-bot)
  | 'PARSE_ERROR' // cambió el HTML y no pudimos extraer los datos
  | 'NOT_USD' // el precio no está en dólares (no comparable)
  | 'NO_BENCHMARK' // no se encontraron comparables suficientes
  | 'TIMEOUT' // se agotó el tiempo de navegación
  | 'UNKNOWN';

const USER_MESSAGES: Record<AnalysisErrorCode, string> = {
  INVALID_URL:
    'La URL no parece válida. Pegá el link completo de una publicación de Zonaprop o Argenprop.',
  UNSUPPORTED_PORTAL:
    'Por ahora solo soportamos Zonaprop y Argenprop. Pegá un link de alguno de esos portales.',
  PROPERTY_NOT_FOUND:
    'No encontramos la propiedad. Puede que la publicación haya sido dada de baja o que el link sea incorrecto.',
  BLOCKED:
    'El portal bloqueó el acceso automático (protección anti-bot). Esperá unos minutos y volvé a intentar.',
  PARSE_ERROR:
    'No pudimos leer los datos de la publicación. Es posible que el portal haya cambiado su estructura.',
  NOT_USD:
    'Esta publicación no está en dólares. El análisis de mercado solo funciona con precios en USD.',
  NO_BENCHMARK:
    'No encontramos suficientes propiedades similares en la zona para comparar. Probá con otra propiedad o zona.',
  TIMEOUT:
    'El portal tardó demasiado en responder. Revisá tu conexión y volvé a intentar.',
  UNKNOWN: 'Ocurrió un error inesperado al analizar la propiedad. Intentá de nuevo.',
};

const HTTP_STATUS: Record<AnalysisErrorCode, number> = {
  INVALID_URL: 400,
  UNSUPPORTED_PORTAL: 400,
  PROPERTY_NOT_FOUND: 404,
  BLOCKED: 503,
  PARSE_ERROR: 502,
  NOT_USD: 422,
  NO_BENCHMARK: 422,
  TIMEOUT: 504,
  UNKNOWN: 500,
};

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  readonly userMessage: string;
  readonly httpStatus: number;

  constructor(code: AnalysisErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'AnalysisError';
    this.code = code;
    this.userMessage = USER_MESSAGES[code];
    this.httpStatus = HTTP_STATUS[code];
  }
}

/** Normaliza cualquier error a un AnalysisError para responder al usuario. */
export function toAnalysisError(err: unknown): AnalysisError {
  if (err instanceof AnalysisError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return new AnalysisError('TIMEOUT', message);
  }
  if (lower.includes('net::') || lower.includes('econnrefused') || lower.includes('dns')) {
    return new AnalysisError('BLOCKED', message);
  }
  return new AnalysisError('UNKNOWN', message);
}
