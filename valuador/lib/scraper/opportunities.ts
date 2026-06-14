import * as cheerio from 'cheerio';
import type { Opportunity, ScanFilters, ScanResult } from '../types';
import { fetchHtml } from './fetch';
import {
  parseAmbientes,
  parseDaysPublished,
  parseSurfaceM2,
  parseUsdPrice,
  slugifyNeighborhood,
} from './parse';

// Páginas de resultados a escanear por búsqueda (cada una ~25-30 avisos).
const MAX_PAGES = Number(process.env.SCAN_MAX_PAGES ?? 3);

interface RawCard {
  url: string | null;
  locationRaw: string | null;
  priceUsd: number;
  surfaceM2: number;
  pricePerM2: number;
  ambientes: number | null;
  daysPublished: number | null;
}

/**
 * Escanea Zonaprop con los criterios del inmobiliario y devuelve los avisos
 * cuyo precio/m² está por debajo del precio/m² de referencia (oportunidades).
 */
export async function scanOpportunities(filters: ScanFilters): Promise<ScanResult> {
  const tipoPlural = filters.propertyType === 'casa' ? 'casas' : 'departamentos';
  const zonaSlug = slugifyNeighborhood(filters.zona) || 'tigre';

  const seen = new Set<string>();
  const cards: RawCard[] = [];
  let firstUrl = '';

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = buildSearchUrl(tipoPlural, zonaSlug, filters.ambientes, page);
    if (page === 1) firstUrl = url;

    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      // La primera página define si la búsqueda es válida; las siguientes
      // pueden no existir y simplemente cortamos.
      if (page === 1) throw err;
      break;
    }

    const pageCards = parseCards(html);
    if (pageCards.length === 0) break; // no hay más resultados

    for (const c of pageCards) {
      const key = c.url ?? `${c.priceUsd}-${c.surfaceM2}-${c.locationRaw}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(c);
    }
  }

  const ref = filters.refPricePerM2;
  const opportunities: Opportunity[] = cards
    .filter((c) => c.pricePerM2 <= ref)
    .map((c) => ({
      url: c.url,
      locationRaw: c.locationRaw,
      priceUsd: c.priceUsd,
      surfaceM2: c.surfaceM2,
      pricePerM2: Math.round(c.pricePerM2),
      ambientes: c.ambientes,
      discountPct: Math.round(((ref - c.pricePerM2) / ref) * 10000) / 10000,
      daysPublished: c.daysPublished,
    }))
    .sort((a, b) => b.discountPct - a.discountPct);

  return {
    filters,
    scannedCount: cards.length,
    opportunities,
    searchUrl: firstUrl,
    scannedAt: new Date().toISOString(),
  };
}

/** Arma la URL SEO de búsqueda de Zonaprop. */
function buildSearchUrl(
  tipoPlural: string,
  zonaSlug: string,
  ambientes: number | null,
  page: number,
): string {
  let path = `${tipoPlural}-venta-${zonaSlug}`;
  if (ambientes && ambientes > 0) path += `-${ambientes}-ambientes`;
  if (page > 1) path += `-pagina-${page}`;
  return `https://www.zonaprop.com.ar/${path}.html`;
}

/** Parsea TODAS las tarjetas de una página de resultados de Zonaprop. */
function parseCards(html: string): RawCard[] {
  const $ = cheerio.load(html);
  const out: RawCard[] = [];

  $('[data-qa="posting PROPERTY"]').each((_, el) => {
    const card = $(el);
    const get = (sel: string) =>
      card.find(sel).first().text().replace(/\s+/g, ' ').trim() || null;

    const featuresText = get('[data-qa="POSTING_CARD_FEATURES"]');
    const priceUsd = parseUsdPrice(get('[data-qa="POSTING_CARD_PRICE"]'));
    const surfaceM2 = parseSurfaceM2(featuresText);
    if (priceUsd == null || surfaceM2 == null || surfaceM2 <= 0) return;

    const href =
      card.attr('data-to-posting') ?? card.find('a[href]').first().attr('href') ?? null;

    out.push({
      url: href ? new URL(href, 'https://www.zonaprop.com.ar').toString() : null,
      locationRaw:
        get('[data-qa="POSTING_CARD_LOCATION"]') ??
        get('.postingLocations-module__location-text'),
      priceUsd,
      surfaceM2,
      pricePerM2: priceUsd / surfaceM2,
      ambientes: parseAmbientes(featuresText),
      daysPublished: parseDaysPublished(card.text().replace(/\s+/g, ' ')),
    });
  });

  return out;
}
