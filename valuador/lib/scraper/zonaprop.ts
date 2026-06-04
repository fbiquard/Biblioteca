import * as cheerio from 'cheerio';
import { AnalysisError } from '../errors';
import type { ComparableProperty, PropertyType, ScrapedProperty } from '../types';
import { fetchHtml } from './fetch';
import {
  parseDaysPublished,
  parsePropertyType,
  parseSurfaceM2,
  parseUsdPrice,
  slugifyNeighborhood,
} from './parse';

const BENCHMARK_SAMPLE_SIZE = Number(process.env.BENCHMARK_SAMPLE_SIZE ?? 20);
// Mínimo de tarjetas para dar por buena una búsqueda; si no, probamos plan B.
const MIN_CARDS = 5;

/**
 * Lee un campo del bloque de datos embebido de Zonaprop (estilo dataLayer):
 *   'precioVenta': "USD 270000"   |   'barrio': 'Troncos del Talar'
 * Es mucho más estable que los selectores del DOM.
 */
function dataField(html: string, key: string): string | null {
  const m = html.match(new RegExp(`['"]${key}['"]\\s*:\\s*["']([^"']*)["']`));
  const val = m?.[1]?.trim();
  return val && val.length > 0 ? val : null;
}

/** Extrae los datos de una publicación individual de Zonaprop. */
export async function scrapeZonapropProperty(url: string): Promise<ScrapedProperty> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const txt = (sel: string) => $(sel).first().text().replace(/\s+/g, ' ').trim() || null;
  const bodyText = $('body').text();

  // 1) Fuente principal: bloque de datos embebido.
  const precioVenta = dataField(html, 'precioVenta');
  const barrio = dataField(html, 'barrio');
  const ciudad = dataField(html, 'ciudad');
  const tipoProp = dataField(html, 'tipoDePropiedad');

  // 2) Fallbacks por DOM / texto.
  const featuresText = txt('#section-icon-features-property') ?? txt('.section-icon-features');
  const titleText = txt('h1');

  const priceUsd =
    parseUsdPrice(precioVenta) ??
    parseUsdPrice(txt('.price-value')) ??
    parseUsdPrice(firstPriceLine(bodyText));
  if (priceUsd == null) {
    if (/(\$|pesos|ars)/i.test(precioVenta ?? bodyText.slice(0, 2000))) {
      throw new AnalysisError('NOT_USD');
    }
    throw new AnalysisError('PARSE_ERROR', 'No se encontró precio en la publicación de Zonaprop.');
  }

  const surfaceM2 =
    parseSurfaceM2(featuresText) ?? parseSurfaceM2(titleText) ?? parseSurfaceM2(bodyText);
  if (surfaceM2 == null) {
    throw new AnalysisError('PARSE_ERROR', 'No se encontró la superficie en m².');
  }

  const neighborhood =
    barrio ?? ciudad ?? neighborhoodFromText(txt('.section-location-property') ?? titleText);

  return {
    portal: 'zonaprop',
    url,
    title: titleText,
    priceUsd,
    surfaceM2,
    propertyType: parsePropertyType(tipoProp ?? titleText ?? url),
    neighborhood,
    city: ciudad ?? null,
    locationRaw: [barrio, ciudad].filter(Boolean).join(', ') || titleText,
    daysPublished: parseDaysPublished(bodyText),
  };
}

interface BenchmarkInput {
  propertyType: PropertyType | null;
  neighborhood: string | null;
  city?: string | null;
  surfaceM2: number;
}

/**
 * Scrapea las primeras N propiedades similares en venta de la misma subzona
 * en Zonaprop. Prueba barrio -> ciudad -> Tigre hasta conseguir muestra.
 */
export async function scrapeZonapropBenchmark(
  input: BenchmarkInput,
): Promise<{ comparables: ComparableProperty[]; searchUrl: string }> {
  const tipo = input.propertyType === 'casa' ? 'casas' : 'departamentos';

  // Candidatos de zona, de más específico a más general, sin repetir.
  const zonas = Array.from(
    new Set(
      [input.neighborhood, input.city, 'tigre']
        .filter((z): z is string => !!z)
        .map(slugifyNeighborhood)
        .filter(Boolean),
    ),
  ).slice(0, 3);

  let best: { comparables: ComparableProperty[]; searchUrl: string } | null = null;

  for (const zona of zonas) {
    const searchUrl = `https://www.zonaprop.com.ar/${tipo}-venta-${zona}.html`;
    let comparables: ComparableProperty[] = [];
    try {
      comparables = parseSearchCards(await fetchHtml(searchUrl));
    } catch {
      continue; // 500/bloqueo intermitente de esa zona: probamos la siguiente
    }
    if (comparables.length >= MIN_CARDS) {
      return { comparables, searchUrl };
    }
    // Guardamos la mejor muestra parcial por si ninguna llega al mínimo.
    if (!best || comparables.length > best.comparables.length) {
      best = { comparables, searchUrl };
    }
  }

  if (best) return best;
  throw new AnalysisError('NO_BENCHMARK', 'No se pudo obtener una muestra comparable de Zonaprop.');
}

/** Parsea las tarjetas de un HTML de resultados de Zonaprop. */
function parseSearchCards(html: string): ComparableProperty[] {
  const $ = cheerio.load(html);
  const comparables: ComparableProperty[] = [];

  $('[data-qa="posting PROPERTY"]')
    .slice(0, BENCHMARK_SAMPLE_SIZE)
    .each((_, el) => {
      const card = $(el);
      const cardTxt = (sel: string) =>
        card.find(sel).first().text().replace(/\s+/g, ' ').trim() || null;

      const priceUsd = parseUsdPrice(cardTxt('[data-qa="POSTING_CARD_PRICE"]'));
      const surfaceM2 = parseSurfaceM2(cardTxt('[data-qa="POSTING_CARD_FEATURES"]'));
      if (priceUsd == null || surfaceM2 == null || surfaceM2 <= 0) return;

      const href =
        card.attr('data-to-posting') ?? card.find('a[href]').first().attr('href') ?? null;

      comparables.push({
        priceUsd,
        surfaceM2,
        pricePerM2: priceUsd / surfaceM2,
        url: href ? new URL(href, 'https://www.zonaprop.com.ar').toString() : null,
        locationRaw: cardTxt('[data-qa="POSTING_CARD_LOCATION"]'),
        daysPublished: parseDaysPublished(card.text().replace(/\s+/g, ' ')),
      });
    });

  return comparables;
}

/** Toma la primera línea con un precio en USD del texto del body. */
function firstPriceLine(body: string): string | null {
  const line = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /(u\$s|us\$|usd)/i.test(l) && /\d{4,}/.test(l));
  return line ?? null;
}

/** Toma el primer segmento de un texto de ubicación como barrio. */
function neighborhoodFromText(locationText: string | null): string | null {
  if (!locationText) return null;
  const segment = locationText.split(',')[0]?.trim();
  return segment && segment.length > 1 ? segment : null;
}
