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

/** Extrae los datos de una publicación individual de Zonaprop. */
export async function scrapeZonapropProperty(url: string): Promise<ScrapedProperty> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const txt = (sel: string) => $(sel).first().text().replace(/\s+/g, ' ').trim() || null;
  const bodyText = $('body').text();

  const priceText =
    txt('[data-qa="adPrice"]') ?? txt('.price-value') ?? txt('.price-items');
  const titleText = txt('h1');
  const locationText =
    txt('[data-qa="LOCATION"]') ??
    txt('.title-location') ??
    txt('h2.title-location') ??
    txt('.section-location-property');
  const featuresText =
    txt('#section-icon-features-property') ??
    txt('[data-qa="section-icon-features"]') ??
    txt('.section-icon-features');

  const priceUsd = parseUsdPrice(priceText) ?? parseUsdPrice(firstPriceLine(bodyText));
  if (priceUsd == null) {
    if (/(\$|pesos|ars)/i.test(priceText ?? bodyText.slice(0, 2000))) {
      throw new AnalysisError('NOT_USD');
    }
    throw new AnalysisError('PARSE_ERROR', 'No se encontró precio en la publicación de Zonaprop.');
  }

  const surfaceM2 =
    parseSurfaceM2(featuresText) ?? parseSurfaceM2(titleText) ?? parseSurfaceM2(bodyText);
  if (surfaceM2 == null) {
    throw new AnalysisError('PARSE_ERROR', 'No se encontró la superficie en m².');
  }

  const locationRaw = locationText ?? titleText ?? null;

  return {
    portal: 'zonaprop',
    url,
    title: titleText,
    priceUsd,
    surfaceM2,
    propertyType: parsePropertyType(titleText ?? url),
    neighborhood: neighborhoodFromUrlOrText(url, locationRaw),
    locationRaw,
    daysPublished: parseDaysPublished(bodyText),
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
  input: BenchmarkInput,
): Promise<{ comparables: ComparableProperty[]; searchUrl: string }> {
  const searchUrl = buildSearchUrl(input);
  const html = await fetchHtml(searchUrl);
  const $ = cheerio.load(html);

  const comparables: ComparableProperty[] = [];

  $('[data-qa="posting PROPERTY"]')
    .slice(0, BENCHMARK_SAMPLE_SIZE)
    .each((_, el) => {
      const card = $(el);
      const cardTxt = (sel: string) =>
        card.find(sel).first().text().replace(/\s+/g, ' ').trim() || null;

      const priceText = cardTxt('[data-qa="POSTING_CARD_PRICE"]');
      const featuresText = cardTxt('[data-qa="POSTING_CARD_FEATURES"]');
      const locationText =
        cardTxt('[data-qa="POSTING_CARD_LOCATION"]') ??
        cardTxt('.postingLocations-module__location-text');
      const href = card.find('a[href]').first().attr('href') ?? null;
      const cardText = card.text().replace(/\s+/g, ' ').trim();

      const priceUsd = parseUsdPrice(priceText);
      const surfaceM2 = parseSurfaceM2(featuresText);
      if (priceUsd == null || surfaceM2 == null || surfaceM2 <= 0) return;

      comparables.push({
        priceUsd,
        surfaceM2,
        pricePerM2: priceUsd / surfaceM2,
        url: href ? new URL(href, 'https://www.zonaprop.com.ar').toString() : null,
        locationRaw: locationText,
        daysPublished: parseDaysPublished(cardText),
      });
    });

  return { comparables, searchUrl };
}

/** Construye la URL de búsqueda SEO de Zonaprop para la subzona. */
function buildSearchUrl(input: BenchmarkInput): string {
  const tipo = input.propertyType === 'casa' ? 'casas' : 'departamentos';
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

/** Detecta barrio desde el texto de ubicación o desde el slug de la URL. */
function neighborhoodFromUrlOrText(url: string, locationText: string | null): string | null {
  if (locationText) {
    const segment = locationText.split(',')[0]?.trim();
    if (segment && segment.length > 1) return segment;
  }
  const m = url.match(/venta-en-([a-z0-9-]+?)-\d|en-venta-([a-z0-9-]+)/i);
  const slug = m?.[1] ?? m?.[2];
  if (slug) return slug.replace(/-/g, ' ');
  return null;
}
