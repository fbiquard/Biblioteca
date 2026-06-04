import { AnalysisError } from '../errors';
import type { Portal } from '../types';

export interface ParsedUrl {
  portal: Portal;
  url: string;
}

/**
 * Valida y normaliza la URL ingresada por el usuario.
 * Lanza AnalysisError('INVALID_URL' | 'UNSUPPORTED_PORTAL') si corresponde.
 */
export function parsePropertyUrl(raw: string): ParsedUrl {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) throw new AnalysisError('INVALID_URL');

  let parsed: URL;
  try {
    // Aceptamos que el usuario pegue sin protocolo.
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new AnalysisError('INVALID_URL');
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

  if (host.endsWith('zonaprop.com.ar')) {
    assertHasPath(parsed);
    return { portal: 'zonaprop', url: parsed.toString() };
  }
  if (host.endsWith('argenprop.com')) {
    assertHasPath(parsed);
    return { portal: 'argenprop', url: parsed.toString() };
  }

  // Dominios conocidos pero no soportados todavía.
  if (host.includes('mercadolibre') || host.includes('properati') || host.includes('remax')) {
    throw new AnalysisError('UNSUPPORTED_PORTAL');
  }

  throw new AnalysisError('UNSUPPORTED_PORTAL');
}

/** Una publicación real siempre tiene path; el home no es analizable. */
function assertHasPath(parsed: URL): void {
  if (parsed.pathname === '/' || parsed.pathname === '') {
    throw new AnalysisError('INVALID_URL');
  }
}
