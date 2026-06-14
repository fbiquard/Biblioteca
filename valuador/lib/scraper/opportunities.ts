import * as cheerio from 'cheerio';
import type { Opportunity, PropertyType, ScanFilters, ScanResult } from '../types';
import { fetchHtml } from './fetch';
import {
  parseAmbientes,
  parseDaysPublished,
  parseSurfaces,
  parseUsdPrice,
  slugifyNeighborhood,
  surfaceForPricePerM2,
} from './parse';

// Páginas a escanear por portal (cada una ~20-30 avisos).
const MAX_PAGES = Number(process.env.SCAN_MAX_PAGES ?? 3);
// Descuento extremo respecto a la referencia que casi siempre es un error de
// dato (terreno cargado como m², typo): por debajo de ref*FLOOR lo descartamos.
const OUTLIER_FLOOR = 0.4;

interface RawCard extends Omit<Opportunity, 'discountPct'> {}

/**
 * Escanea Zonaprop y Argenprop con los criterios del inmobiliario y devuelve
 * los avisos cuyo precio/m² está por debajo de la referencia (oportunidades).
 */
export async function scanOpportunities(filters: ScanFilters): Promise<ScanResult> {
  // Escaneamos ambos portales en paralelo (cada uno tolera su propio fallo).
  const [zona, argen] = await Promise.all([
    scanPortal('zonaprop', filters),
    scanPortal('argenprop', filters),
  ]);

  // Si NINGÚN portal devolvió nada y el principal falló, propagamos el error.
  if (zona.cards.length === 0 && argen.cards.length === 0 && zona.error) {
    throw zona.error;
  }

  const ref = filters.refPricePerM2;
  const floor = ref * OUTLIER_FLOOR;
  const min = filters.minPrice ?? 0;
  const max = filters.maxPrice ?? Infinity;
  const seen = new Set<string>();
  const cards = [...zona.cards, ...argen.cards];

  const opportunities: Opportunity[] = [];
  for (const c of cards) {
    if (c.pricePerM2 > ref || c.pricePerM2 < floor) continue; // fuera de rango / outlier
    if (c.priceUsd < min || c.priceUsd > max) continue; // fuera del rango de precio total
    const key = dedupeKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    opportunities.push({
      ...c,
      pricePerM2: Math.round(c.pricePerM2),
      discountPct: Math.round(((ref - c.pricePerM2) / ref) * 10000) / 10000,
    });
  }
  opportunities.sort((a, b) => b.discountPct - a.discountPct);

  return {
    filters,
    scannedCount: cards.length,
    opportunities,
    searchUrl: zona.searchUrl || argen.searchUrl,
    scannedAt: new Date().toISOString(),
  };
}

// ---------------- por portal ----------------

interface PortalScan {
  cards: RawCard[];
  searchUrl: string;
  error: unknown | null;
}

async function scanPortal(
  portal: 'zonaprop' | 'argenprop',
  filters: ScanFilters,
): Promise<PortalScan> {
  const zonaSlug = slugifyNeighborhood(filters.zona) || 'tigre';
  const cards: RawCard[] = [];
  let searchUrl = '';
  let error: unknown | null = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      portal === 'zonaprop'
        ? zonapropUrl(filters.propertyType, zonaSlug, filters.ambientes, page)
        : argenpropUrl(filters.propertyType, zonaSlug, filters.ambientes, page);
    if (page === 1) searchUrl = url;

    const parse = (html: string) =>
      portal === 'zonaprop'
        ? parseZonapropCards(html)
        : parseArgenpropCards(html);

    let pageCards: RawCard[] = [];
    try {
      pageCards = parse(await fetchHtml(url));
      // Argenprop a veces devuelve una página vacía en el primer hit: 1 reintento.
      if (pageCards.length === 0 && page === 1) {
        pageCards = parse(await fetchHtml(url));
      }
    } catch (err) {
      if (page === 1) error = err;
      break;
    }

    if (pageCards.length === 0) break;
    cards.push(...pageCards);
  }

  return { cards, searchUrl, error };
}

// ---------------- Zonaprop ----------------

function zonapropUrl(
  type: PropertyType,
  zona: string,
  amb: number | null,
  page: number,
): string {
  const tipo = type === 'casa' ? 'casas' : 'departamentos';
  let path = `${tipo}-venta-${zona}`;
  if (amb && amb > 0) path += `-${amb}-ambientes`;
  if (page > 1) path += `-pagina-${page}`;
  return `https://www.zonaprop.com.ar/${path}.html`;
}

function parseZonapropCards(html: string): RawCard[] {
  const $ = cheerio.load(html);
  const out: RawCard[] = [];

  $('[data-qa="posting PROPERTY"]').each((_, el) => {
    const card = $(el);
    const get = (sel: string) =>
      card.find(sel).first().text().replace(/\s+/g, ' ').trim() || null;

    const featuresText = get('[data-qa="POSTING_CARD_FEATURES"]');
    const priceUsd = parseUsdPrice(get('[data-qa="POSTING_CARD_PRICE"]'));
    const surface = surfaceForPricePerM2(parseSurfaces(featuresText));
    if (priceUsd == null || surface == null) return;

    const href =
      card.attr('data-to-posting') ?? card.find('a[href]').first().attr('href') ?? null;

    out.push({
      portal: 'zonaprop',
      url: href ? new URL(href, 'https://www.zonaprop.com.ar').toString() : null,
      locationRaw: get('[data-qa="POSTING_CARD_LOCATION"]'),
      priceUsd,
      surfaceM2: surface.value,
      surfaceKind: surface.kind,
      pricePerM2: priceUsd / surface.value,
      ambientes: parseAmbientes(featuresText),
      daysPublished: parseDaysPublished(card.text().replace(/\s+/g, ' ')),
    });
  });

  return out;
}

// ---------------- Argenprop ----------------

function argenpropUrl(
  type: PropertyType,
  zona: string,
  amb: number | null,
  page: number,
): string {
  const tipo = type === 'casa' ? 'casas' : 'departamentos';
  const params: string[] = [];
  if (amb && amb > 0) params.push(`ambientes-${amb}`);
  if (page > 1) params.push(`pagina-${page}`);
  const query = params.length ? `?${params.join('&')}` : '';
  return `https://www.argenprop.com/${tipo}/venta/${zona}${query}`;
}

function parseArgenpropCards(html: string): RawCard[] {
  const $ = cheerio.load(html);
  const out: RawCard[] = [];

  $('a.card').each((_, el) => {
    const card = $(el);
    const get = (sel: string) =>
      card.find(sel).first().text().replace(/\s+/g, ' ').trim() || null;

    const featuresText = get('.card__main-features');
    const priceUsd = parseUsdPrice(get('.card__price'));
    const surface = surfaceForPricePerM2(parseSurfaces(featuresText));
    if (priceUsd == null || surface == null) return;

    const href = card.attr('href') ?? null;

    out.push({
      portal: 'argenprop',
      url: href ? new URL(href, 'https://www.argenprop.com').toString() : null,
      locationRaw: get('.card__title--primary') ?? get('.card__address'),
      priceUsd,
      surfaceM2: surface.value,
      surfaceKind: surface.kind,
      pricePerM2: priceUsd / surface.value,
      ambientes: parseAmbientes(featuresText),
      daysPublished: parseDaysPublished(card.text().replace(/\s+/g, ' ')),
    });
  });

  return out;
}

/** Clave de deduplicación. Ignora el query string (cambia por página/posición). */
function dedupeKey(c: RawCard): string {
  if (c.url) {
    try {
      const u = new URL(c.url);
      return u.origin + u.pathname;
    } catch {
      return c.url.split('?')[0];
    }
  }
  const loc = (c.locationRaw ?? '').toLowerCase().slice(0, 12);
  return `${c.priceUsd}-${c.surfaceM2}-${loc}`;
}
