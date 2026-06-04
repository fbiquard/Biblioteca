import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { AnalysisError } from '../errors';

const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS ?? 30000);

// User-agent realista de Chrome desktop para reducir bloqueos triviales.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Lanza un navegador headless y ejecuta `fn` con una página ya configurada.
 * Garantiza el cierre del navegador aunque `fn` falle.
 */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
    });
  } catch (err) {
    // Típicamente: el binario de Chromium no está instalado.
    throw new AnalysisError(
      'UNKNOWN',
      `No se pudo iniciar el navegador. ¿Corriste "npx playwright install chromium"? (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }

  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'es-AR',
      timezoneId: 'America/Argentina/Buenos_Aires',
      viewport: { width: 1366, height: 900 },
      // Tolera proxies de egress que interceptan TLS (entornos corporativos / sandbox).
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      },
    });

    // Bloqueamos recursos pesados para acelerar y reducir huella.
    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(SCRAPE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(SCRAPE_TIMEOUT_MS);
    return await fn(page);
  } finally {
    await context?.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * Navega a una URL y devuelve el HTML. Detecta los casos clásicos:
 * 404 (propiedad dada de baja) y bloqueos anti-bot.
 */
export async function gotoAndGetHtml(page: Page, url: string): Promise<string> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status = response?.status() ?? 0;

  if (status === 404 || status === 410) {
    throw new AnalysisError('PROPERTY_NOT_FOUND');
  }
  if (status === 403 || status === 429) {
    throw new AnalysisError('BLOCKED');
  }

  const html = await page.content();
  detectBlockOrNotFound(html);
  return html;
}

/** Heurísticas de bloqueo / no encontrado sobre el HTML renderizado. */
export function detectBlockOrNotFound(html: string): void {
  const lower = html.toLowerCase();

  // Pantallas anti-bot (DataDome, Cloudflare, reCAPTCHA).
  if (
    lower.includes('captcha-delivery.com') ||
    lower.includes('datadome') ||
    lower.includes('verifica que eres un humano') ||
    lower.includes('verifying you are human') ||
    lower.includes('please enable javascript and cookies') ||
    lower.includes('attention required! | cloudflare')
  ) {
    throw new AnalysisError('BLOCKED');
  }

  // Páginas de error / aviso dado de baja.
  if (
    lower.includes('la publicación que estás buscando ya no se encuentra') ||
    lower.includes('aviso no disponible') ||
    lower.includes('esta publicación ya no está disponible') ||
    lower.includes('página no encontrada')
  ) {
    throw new AnalysisError('PROPERTY_NOT_FOUND');
  }
}
