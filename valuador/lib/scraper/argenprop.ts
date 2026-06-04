import type { Page } from 'playwright';
import { AnalysisError } from '../errors';
import type { ScrapedProperty } from '../types';
import { gotoAndGetHtml } from './browser';
import {
  parseDaysPublished,
  parsePropertyType,
  parseSurfaceM2,
  parseUsdPrice,
} from './parse';

interface RawDetail {
  priceText: string | null;
  titleText: string | null;
  locationText: string | null;
  featuresText: string | null;
  bodyText: string;
}

/** Extrae los datos de una publicación individual de Argenprop. */
export async function scrapeArgenpropProperty(page: Page, url: string): Promise<ScrapedProperty> {
  await gotoAndGetHtml(page, url);

  await page
    .waitForSelector('.titlebar__price, h1', { timeout: 15000 })
    .catch(() => {});

  const raw = await page.evaluate((): RawDetail => {
    const text = (sel: string): string | null =>
      document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
    return {
      priceText:
        text('.titlebar__price') ?? text('[class*="price"]') ?? text('.precio-valor'),
      titleText: text('h1') ?? text('.titlebar__address'),
      locationText:
        text('.titlebar__address') ?? text('[class*="location"]') ?? text('.section-location'),
      featuresText:
        text('.property-features') ??
        text('.section-icon-features') ??
        text('[class*="feature"]'),
      bodyText: document.body?.innerText ?? '',
    };
  });

  const priceUsd = parseUsdPrice(raw.priceText) ?? parseUsdPrice(raw.bodyText.slice(0, 3000));
  if (priceUsd == null) {
    if (/(\$|pesos|ars)/i.test(raw.priceText ?? raw.bodyText.slice(0, 2000))) {
      throw new AnalysisError('NOT_USD');
    }
    throw new AnalysisError('PARSE_ERROR', 'No se encontró precio en la publicación de Argenprop.');
  }

  const surfaceM2 =
    parseSurfaceM2(raw.featuresText) ?? parseSurfaceM2(raw.titleText) ?? parseSurfaceM2(raw.bodyText);
  if (surfaceM2 == null) {
    throw new AnalysisError('PARSE_ERROR', 'No se encontró la superficie en m².');
  }

  const locationRaw = raw.locationText ?? raw.titleText ?? null;
  const neighborhood = locationRaw ? locationRaw.split(',')[0]?.trim() ?? null : null;

  return {
    portal: 'argenprop',
    url,
    title: raw.titleText,
    priceUsd,
    surfaceM2,
    propertyType: parsePropertyType(raw.titleText ?? url),
    neighborhood,
    locationRaw,
    daysPublished: parseDaysPublished(raw.bodyText),
  };
}
