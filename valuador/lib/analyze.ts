import { toAnalysisError } from './errors';
import { scrapeArgenpropProperty } from './scraper/argenprop';
import { parsePropertyUrl } from './scraper/url';
import { scrapeZonapropBenchmark, scrapeZonapropProperty } from './scraper/zonaprop';
import type { AnalysisResult } from './types';
import { buildBenchmark, buildVerdict } from './valuation';

/**
 * Flujo completo de análisis:
 *  1. Valida la URL.
 *  2. Lee la propiedad ingresada (Zonaprop o Argenprop) vía servicio de scraping.
 *  3. Lee ~20 comparables de la misma subzona en Zonaprop.
 *  4. Calcula benchmark y veredicto.
 */
export async function analyzeProperty(rawUrl: string): Promise<AnalysisResult> {
  const { portal, url } = parsePropertyUrl(rawUrl);

  try {
    const property =
      portal === 'zonaprop'
        ? await scrapeZonapropProperty(url)
        : await scrapeArgenpropProperty(url);

    // El benchmark siempre sale de Zonaprop (mayor volumen de avisos en ZN).
    const { comparables, searchUrl } = await scrapeZonapropBenchmark({
      propertyType: property.propertyType,
      neighborhood: property.neighborhood,
      surfaceM2: property.surfaceM2,
    });

    const benchmark = buildBenchmark(property, comparables, searchUrl);
    const verdict = buildVerdict(property, benchmark);

    return {
      property,
      benchmark,
      verdict,
      analyzedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw toAnalysisError(err);
  }
}
