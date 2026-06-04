import type { Page } from 'playwright';
import { AnalysisError } from '../errors';
import type { ComparableProperty, PropertyType, ScrapedProperty } from '../types';
import { gotoAndGetHtml } from './browser';
import {
  parseDaysPublished,
  parsePropertyType,
  parseSurfaceM2,
  parseUsdPrice,
  slugifyNeighborhood,
} from './parse';

const BENCHMARK_SAMPLE_SIZE = Number(process.env.BENCHMARK_SAMPLE_SIZE ?? 20);

interface RawDetail {
  priceText: string | null;
  titleText: string | null;
  locationText: string | null;
  featuresText: string | null;
  bodyText: string;
}

/** Extrae los datos de una publicación individual de Zonaprop. */
export async function scrapeZonapropProperty(page: Page, url: string): Promise<ScrapedProperty> {
  await gotoAndGetHtml(page, url);

  // Esperamos a que renderice el precio o al menos el título.
  await page
    .waitForSelector('[data-qa="adPrice"], h1', { timeout: 15000 })
    .catch(() => {
      /* seguimos con fallback por HTML */
    });

  const raw = await page.evaluate((): RawDetail => {
    const text = (sel: string): string | null =>
      document.querySelector(sel)?.textContent?.trim() ?? null;
    return {
      priceText: text('[data-qa="adPrice"]') ?? text('.price-value') ?? text('.price-items'),
      titleText: text('h1'),
      locationText:
        text('[data-qa="LOCATION"]') ??
        text('.title-location') ??
        text('h2.title-location') ??
        text('.section-location-property'),
      featuresText:
        text('#section-icon-features-property') ??
        text('[data-qa="section-icon-features"]') ??
        text('.section-icon-features'),
      bodyText: document.body?.innerText ?? '',
    };
  });

  const priceUsd = parseUsdPrice(raw.priceText) ?? parseUsdPrice(firstPriceLine(raw.bodyText));
  if (priceUsd == null) {
    // ¿Hay precio pero en pesos? -> NOT_USD; si no hay nada -> PARSE_ERROR.
    if (/(\$|pesos|ars)/i.test(raw.priceText ?? raw.bodyText.slice(0, 2000))) {
      throw new AnalysisError('NOT_USD');
    }
    throw new AnalysisError('PARSE_ERROR', 'No se encontró precio en la publicación de Zonaprop.');
  }

  const surfaceM2 =
    parseSurfaceM2(raw.featuresText) ?? parseSurfaceM2(raw.titleText) ?? parseSurfaceM2(raw.bodyText);
  if (surfaceM2 == null) {
    throw new AnalysisError('PARSE_ERROR', 'No se encontró la superficie en m².');
  }

  const locationRaw = raw.locationText ?? raw.titleText ?? null;
  const neighborhood = neighborhoodFromUrlOrText(url, locationRaw);
  const propertyType = parsePropertyType(raw.titleText ?? url);
  const daysPublished = parseDaysPublished(raw.bodyText);

  return {
    portal: 'zonaprop',
    url,
    title: raw.titleText,
    priceUsd,
    surfaceM2,
    propertyType,
    neighborhood,
    locationRaw,
    daysPublished,
  };
}

interface BenchmarkInput {
  propertyType: PropertyType | null;
  neighborhood: string | null;
  surfaceM2: number;
}

/**
 * Scrapea las primeras N propiedades similares en venta de la misma subzona
 * en Zonaprop, como muestra comparativa para el benchmark.
 */
export async function scrapeZonapropBenchmark(
  page: Page,
  input: BenchmarkInput,
): Promise<{ comparables: ComparableProperty[]; searchUrl: string }> {
  const searchUrl = buildSearchUrl(input);
  await gotoAndGetHtml(page, searchUrl);

  await page
    .waitForSelector('[data-qa="posting PROPERTY"], .postings-container', { timeout: 15000 })
    .catch(() => {});

  const rawCards = await page.evaluate((limit: number) => {
    const cards = Array.from(document.querySelectorAll('[data-qa="posting PROPERTY"]')).slice(
      0,
      limit,
    );
    return cards.map((card) => {
      const q = (sel: string) =>
        card.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
      const link = card.querySelector('a[href]') as HTMLAnchorElement | null;
      return {
        priceText: q('[data-qa="POSTING_CARD_PRICE"]'),
        featuresText: q('[data-qa="POSTING_CARD_FEATURES"]'),
        locationText:
          q('[data-qa="POSTING_CARD_LOCATION"]') ?? q('.postingLocations-module__location-text'),
        href: link?.getAttribute('href') ?? null,
        cardText: (card as HTMLElement).innerText?.replace(/\s+/g, ' ').trim() ?? '',
      };
    });
  }, BENCHMARK_SAMPLE_SIZE);

  const comparables: ComparableProperty[] = [];
  for (const c of rawCards) {
    const priceUsd = parseUsdPrice(c.priceText);
    const surfaceM2 = parseSurfaceM2(c.featuresText);
    if (priceUsd == null || surfaceM2 == null || surfaceM2 <= 0) continue;
    comparables.push({
      priceUsd,
      surfaceM2,
      pricePerM2: priceUsd / surfaceM2,
      url: c.href ? new URL(c.href, 'https://www.zonaprop.com.ar').toString() : null,
      locationRaw: c.locationText,
      daysPublished: parseDaysPublished(c.cardText),
    });
  }

  return { comparables, searchUrl };
}

/** Construye la URL de búsqueda SEO de Zonaprop para la subzona. */
function buildSearchUrl(input: BenchmarkInput): string {
  const tipo = input.propertyType === 'casa' ? 'casas' : 'departamentos';
  // Si no detectamos barrio, caemos al partido de Tigre (MVP zona norte).
  const zona = input.neighborhood ? slugifyNeighborhood(input.neighborhood) : 'tigre';
  return `https://www.zonaprop.com.ar/${tipo}-venta-${zona}.html`;
}

/** Toma la primera línea con un precio en USD del texto del body. */
function firstPriceLine(body: string): string | null {
  const line = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /(u\$s|us\$|usd)/i.test(l) && /\d{4,}/.test(l));
  return line ?? null;
}

/** Detecta barrio desde el slug de la URL o desde el texto de ubicación. */
function neighborhoodFromUrlOrText(url: string, locationText: string | null): string | null {
  if (locationText) {
    // La ubicación suele venir como "Nordelta, Tigre" o "Tigre, Buenos Aires".
    const segment = locationText.split(',')[0]?.trim();
    if (segment && segment.length > 1) return segment;
  }
  // Fallback: extraer del slug de la URL de detalle de Zonaprop.
  const m = url.match(/venta-en-([a-z0-9-]+?)-\d|en-venta-([a-z0-9-]+)/i);
  const slug = m?.[1] ?? m?.[2];
  if (slug) return slug.replace(/-/g, ' ');
  return null;
}
