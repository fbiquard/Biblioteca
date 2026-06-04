import { AnalysisError } from '../errors';

/**
 * Lectura de páginas a través de un servicio de scraping que renderiza JS y
 * esquiva protecciones anti-bot (DataDome / Cloudflare) usando proxies.
 *
 * Configurable por variables de entorno:
 *   SCRAPER_PROVIDER  = scraperapi | scrapingbee | zenrows   (default: scraperapi)
 *   SCRAPER_API_KEY   = la API key del servicio elegido
 *   SCRAPE_TIMEOUT_MS = timeout por request (default 60000)
 *
 * Si no hay API key, intenta una lectura directa (probablemente bloqueada por
 * el portal) para no romper en desarrollo local.
 */

type Provider = 'scraperapi' | 'scrapingbee' | 'zenrows' | 'direct';

const PROVIDER = normalizeProvider(process.env.SCRAPER_PROVIDER);
const API_KEY = process.env.SCRAPER_API_KEY ?? '';
const TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS ?? 60000);

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function normalizeProvider(raw: string | undefined): Provider {
  const p = (raw ?? '').toLowerCase();
  if (p === 'scrapingbee' || p === 'zenrows' || p === 'direct') return p;
  if (p === 'scraperapi') return 'scraperapi';
  // Default: si hay key asumimos scraperapi; si no, lectura directa.
  return process.env.SCRAPER_API_KEY ? 'scraperapi' : 'direct';
}

/** Devuelve el HTML renderizado de la URL objetivo. */
export async function fetchHtml(targetUrl: string): Promise<string> {
  const requestUrl = buildRequestUrl(targetUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      signal: controller.signal,
      headers: PROVIDER === 'direct' ? BROWSER_HEADERS : undefined,
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AnalysisError('TIMEOUT');
    }
    throw new AnalysisError('BLOCKED', err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }

  mapHttpStatus(res.status);

  const html = await res.text();
  detectBlockOrNotFound(html);
  return html;
}

/** Construye la URL del proveedor con render de JS y bypass anti-bot. */
function buildRequestUrl(targetUrl: string): string {
  if (PROVIDER !== 'direct' && !API_KEY) {
    throw new AnalysisError('SCRAPER_NOT_CONFIGURED');
  }
  const enc = encodeURIComponent(targetUrl);

  switch (PROVIDER) {
    case 'scraperapi':
      // ultra_premium activa el pool con bypass de anti-bots tipo DataDome.
      return `https://api.scraperapi.com/?api_key=${API_KEY}&url=${enc}&render=true&country_code=ar&ultra_premium=true`;
    case 'scrapingbee':
      return `https://app.scrapingbee.com/api/v1/?api_key=${API_KEY}&url=${enc}&render_js=true&stealth_proxy=true&country_code=ar`;
    case 'zenrows':
      return `https://api.zenrows.com/v1/?apikey=${API_KEY}&url=${enc}&js_render=true&antibot=true&proxy_country=ar`;
    case 'direct':
    default:
      return targetUrl;
  }
}

/** Traduce el status HTTP del servicio/portal a un AnalysisError. */
function mapHttpStatus(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 404 || status === 410) throw new AnalysisError('PROPERTY_NOT_FOUND');
  if (status === 401 || status === 403) {
    // 401 del servicio = key inválida; 403 = bloqueo. Ambos los reportamos claro.
    throw new AnalysisError(
      status === 401 ? 'SCRAPER_NOT_CONFIGURED' : 'BLOCKED',
      `HTTP ${status}`,
    );
  }
  if (status === 429) throw new AnalysisError('BLOCKED', 'HTTP 429 (rate limit)');
  if (status >= 500) throw new AnalysisError('BLOCKED', `HTTP ${status}`);
  throw new AnalysisError('UNKNOWN', `HTTP ${status}`);
}

/** Heurísticas de bloqueo / no encontrado sobre el HTML recibido. */
export function detectBlockOrNotFound(html: string): void {
  const lower = html.toLowerCase();

  if (
    lower.includes('captcha-delivery.com') ||
    lower.includes('datadome') ||
    lower.includes('verifica que eres un humano') ||
    lower.includes('verifying you are human') ||
    lower.includes('please enable javascript and cookies') ||
    lower.includes('attention required! | cloudflare') ||
    (lower.includes('<title>un momento') && lower.length < 5000)
  ) {
    throw new AnalysisError('BLOCKED');
  }

  if (
    lower.includes('la publicación que estás buscando ya no se encuentra') ||
    lower.includes('aviso no disponible') ||
    lower.includes('esta publicación ya no está disponible') ||
    lower.includes('página no encontrada')
  ) {
    throw new AnalysisError('PROPERTY_NOT_FOUND');
  }
}
