// Tipos compartidos entre el scraper, la lógica de valuación y la UI.

export type Portal = 'zonaprop' | 'argenprop';

export type PropertyType = 'casa' | 'departamento';

export type OperationType = 'venta';

/** Datos crudos extraídos de la URL de una propiedad. */
export interface ScrapedProperty {
  portal: Portal;
  url: string;
  title: string | null;
  /** Precio en USD. Solo soportamos publicaciones en dólares (mercado real ZN). */
  priceUsd: number;
  /** Superficie total en m². */
  surfaceM2: number;
  propertyType: PropertyType | null;
  /** Barrio / localidad detectada (ej. "Tigre", "Nordelta"). */
  neighborhood: string | null;
  /** Texto de ubicación completo, tal como aparece en la publicación. */
  locationRaw: string | null;
  /** Días que lleva publicada, si se pudo determinar. */
  daysPublished: number | null;
}

/** Una propiedad comparable de la muestra de benchmark. */
export interface ComparableProperty {
  priceUsd: number;
  surfaceM2: number;
  pricePerM2: number;
  url: string | null;
  locationRaw: string | null;
  /** Días publicada, si la card lo expone. */
  daysPublished?: number | null;
}

/** Resultado del benchmark de la subzona. */
export interface Benchmark {
  /** Cantidad de comparables efectivamente usadas (tras filtro de ±20% superficie). */
  sampleSize: number;
  /** Cantidad total de comparables scrapeadas antes de filtrar. */
  scrapedCount: number;
  /** Promedio de precio por m² de las comparables. */
  avgPricePerM2: number;
  /** Mediana de precio por m² (más robusta a outliers). */
  medianPricePerM2: number;
  /** Promedio de días publicados de las comparables, si se pudo determinar. */
  avgDaysPublished: number | null;
  /** URL de búsqueda de Zonaprop usada como fuente del benchmark. */
  searchUrl: string;
  comparables: ComparableProperty[];
}

export type VerdictLabel = 'SUBVALUADA' | 'PRECIO_JUSTO' | 'CARA';

export interface Verdict {
  label: VerdictLabel;
  /** Precio por m² de la propiedad analizada. */
  pricePerM2: number;
  /** Desvío relativo respecto al benchmark: (propiedad - mercado) / mercado. */
  deviation: number;
  /** Señal secundaria basada en días publicados. */
  daysSignal: DaysSignal | null;
}

export interface DaysSignal {
  propertyDays: number;
  avgDays: number;
  /** Cuánto más (o menos) tiempo lleva publicada respecto al promedio. */
  ratio: number;
  message: string;
}

/** Respuesta completa del endpoint /api/analyze. */
export interface AnalysisResult {
  property: ScrapedProperty;
  benchmark: Benchmark;
  verdict: Verdict;
  analyzedAt: string; // ISO timestamp
}

/** Registro que se guarda en el historial. */
export interface HistoryEntry {
  id: string;
  url: string;
  title: string | null;
  neighborhood: string | null;
  propertyType: PropertyType | null;
  priceUsd: number;
  surfaceM2: number;
  pricePerM2: number;
  marketPricePerM2: number;
  deviation: number;
  verdict: VerdictLabel;
  analyzedAt: string;
}
