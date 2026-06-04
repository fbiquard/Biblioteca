import { toAnalysisError } from './errors';
import { scrapeArgenpropProperty } from './scraper/argenprop';
import { withPage } from './scraper/browser';
import { parsePropertyUrl } from './scraper/url';
import { scrapeZonapropBenchmark, scrapeZonapropProperty } from './scraper/zonaprop';
import type { AnalysisResult } from './types';
import { buildBenchmark, buildVerdict } from './valuation';

/**
 * Flujo completo de análisis:
 *  1. Valida la URL.
 *  2. Scrapea la propiedad ingresada (Zonaprop o Argenprop).
 *  3. Scrapea ~20 comparables de la misma subzona en Zonaprop.
 *  4. Calcula benchmark y veredicto.
 *
 * Reutiliza un único navegador para las dos navegaciones.
 */
export async function analyzeProperty(rawUrl: string): Promise<AnalysisResult> {
  const { portal, url } = parsePropertyUrl(rawUrl);

  try {
    return await withPage(async (page) => {
      const property =
        portal === 'zonaprop'
          ? await scrapeZonapropProperty(page, url)
          : await scrapeArgenpropProperty(page, url);

      // El benchmark siempre sale de Zonaprop (mayor volumen de avisos en ZN).
      const { comparables, searchUrl } = await scrapeZonapropBenchmark(page, {
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
    });
  } catch (err) {
    throw toAnalysisError(err);
  }
}
