import * as cheerio from 'cheerio';
import { AnalysisError } from '../errors';
import type { ScrapedProperty } from '../types';
import { fetchHtml } from './fetch';
import {
  parseDaysPublished,
  parsePropertyType,
  parseSurfaceM2,
  parseUsdPrice,
} from './parse';

/** Extrae los datos de una publicación individual de Argenprop. */
export async function scrapeArgenpropProperty(url: string): Promise<ScrapedProperty> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const txt = (sel: string) => $(sel).first().text().replace(/\s+/g, ' ').trim() || null;
  const bodyText = $('body').text();

  const priceText =
    txt('.titlebar__price') ?? txt('[class*="price"]') ?? txt('.precio-valor');
  const titleText = txt('h1') ?? txt('.titlebar__address');
  const locationText =
    txt('.titlebar__address') ?? txt('[class*="location"]') ?? txt('.section-location');
  const featuresText =
    txt('.property-features') ?? txt('.section-icon-features') ?? txt('[class*="feature"]');

  const priceUsd = parseUsdPrice(priceText) ?? parseUsdPrice(bodyText.slice(0, 3000));
  if (priceUsd == null) {
    if (/(\$|pesos|ars)/i.test(priceText ?? bodyText.slice(0, 2000))) {
      throw new AnalysisError('NOT_USD');
    }
    throw new AnalysisError('PARSE_ERROR', 'No se encontró precio en la publicación de Argenprop.');
  }

  const surfaceM2 =
    parseSurfaceM2(featuresText) ?? parseSurfaceM2(titleText) ?? parseSurfaceM2(bodyText);
  if (surfaceM2 == null) {
    throw new AnalysisError('PARSE_ERROR', 'No se encontró la superficie en m².');
  }

  const locationRaw = locationText ?? titleText ?? null;
  const neighborhood = locationRaw ? locationRaw.split(',')[0]?.trim() ?? null : null;

  return {
    portal: 'argenprop',
    url,
    title: titleText,
    priceUsd,
    surfaceM2,
    propertyType: parsePropertyType(titleText ?? url),
    neighborhood,
    locationRaw,
    daysPublished: parseDaysPublished(bodyText),
  };
}
