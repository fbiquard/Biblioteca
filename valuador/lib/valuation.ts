import { AnalysisError } from './errors';
import { mean, median } from './scraper/parse';
import type {
  Benchmark,
  ComparableProperty,
  DaysSignal,
  ScrapedProperty,
  Verdict,
} from './types';

// Umbral de desvío respecto al mercado para clasificar el veredicto.
// |desvío| <= 7% => PRECIO_JUSTO. Por debajo => SUBVALUADA. Por encima => CARA.
const FAIR_THRESHOLD = 0.07;

// Filtro de comparables: superficie dentro de ±20% de la propiedad analizada.
const SURFACE_TOLERANCE = 0.2;

// Mínimo de comparables para considerar el benchmark confiable.
const MIN_COMPARABLES = 3;

/**
 * Construye el benchmark a partir de las comparables crudas, filtrando por
 * superficie similar (±20%) y descartando outliers groseros.
 */
export function buildBenchmark(
  property: ScrapedProperty,
  rawComparables: ComparableProperty[],
  searchUrl: string,
): Benchmark {
  const lo = property.surfaceM2 * (1 - SURFACE_TOLERANCE);
  const hi = property.surfaceM2 * (1 + SURFACE_TOLERANCE);

  // Excluimos la propia propiedad (mismo m² y precio) si apareciera en la muestra.
  const similar = rawComparables.filter(
    (c) =>
      c.surfaceM2 >= lo &&
      c.surfaceM2 <= hi &&
      c.pricePerM2 > 0 &&
      !(c.surfaceM2 === property.surfaceM2 && c.priceUsd === property.priceUsd),
  );

  const filtered = removeOutliers(similar);

  if (filtered.length < MIN_COMPARABLES) {
    throw new AnalysisError(
      'NO_BENCHMARK',
      `Solo se encontraron ${filtered.length} comparables similares (mínimo ${MIN_COMPARABLES}).`,
    );
  }

  const pricesPerM2 = filtered.map((c) => c.pricePerM2);
  const validDays = filtered
    .map((c) => c.daysPublished)
    .filter((d): d is number => d != null);

  return {
    sampleSize: filtered.length,
    scrapedCount: rawComparables.length,
    avgPricePerM2: round(mean(pricesPerM2)),
    medianPricePerM2: round(median(pricesPerM2)),
    avgDaysPublished: validDays.length ? Math.round(mean(validDays)) : null,
    searchUrl,
    comparables: filtered,
  };
}

/** Calcula el veredicto comparando la propiedad contra el benchmark. */
export function buildVerdict(property: ScrapedProperty, benchmark: Benchmark): Verdict {
  const pricePerM2 = property.priceUsd / property.surfaceM2;

  // Usamos la mediana como referencia de mercado (más robusta a outliers).
  const reference = benchmark.medianPricePerM2;
  const deviation = (pricePerM2 - reference) / reference;

  let label: Verdict['label'];
  if (deviation < -FAIR_THRESHOLD) label = 'SUBVALUADA';
  else if (deviation > FAIR_THRESHOLD) label = 'CARA';
  else label = 'PRECIO_JUSTO';

  return {
    label,
    pricePerM2: round(pricePerM2),
    deviation: round(deviation, 4),
    daysSignal: buildDaysSignal(property, benchmark),
  };
}

/** Señal secundaria: días publicada vs promedio de la zona. */
function buildDaysSignal(property: ScrapedProperty, benchmark: Benchmark): DaysSignal | null {
  const propertyDays = property.daysPublished;
  const avgDays = benchmark.avgDaysPublished;
  if (propertyDays == null || avgDays == null || avgDays <= 0) return null;

  const ratio = propertyDays / avgDays;
  let message: string;
  if (ratio >= 1.5) {
    message =
      'Lleva bastante más tiempo publicada que el promedio de la zona: puede haber margen de negociación.';
  } else if (ratio <= 0.6) {
    message = 'Es una publicación reciente respecto al promedio de la zona.';
  } else {
    message = 'Lleva un tiempo publicada similar al promedio de la zona.';
  }

  return { propertyDays, avgDays, ratio: round(ratio, 2), message };
}

/** Descarta outliers por rango intercuartílico (IQR) sobre el precio/m². */
function removeOutliers(comparables: ComparableProperty[]): ComparableProperty[] {
  if (comparables.length < 4) return comparables;
  const sorted = [...comparables].sort((a, b) => a.pricePerM2 - b.pricePerM2);
  const q1 = sorted[Math.floor(sorted.length * 0.25)].pricePerM2;
  const q3 = sorted[Math.floor(sorted.length * 0.75)].pricePerM2;
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter((c) => c.pricePerM2 >= lo && c.pricePerM2 <= hi);
}

function round(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
