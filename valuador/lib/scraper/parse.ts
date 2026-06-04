import type { PropertyType } from '../types';

/**
 * Extrae un precio en USD de un texto. Devuelve null si no hay precio en dólares.
 * Maneja formatos: "USD 250.000", "U$S 250.000", "US$ 250,000", "240.000 dólares".
 */
export function parseUsdPrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ').trim();

  // Si menciona pesos explícitamente y NO dólares, no es comparable.
  const hasUsd = /(u\$s|us\$|usd|d[oó]lares?)/i.test(t);
  const hasArs = /(\$\s*\d|pesos|ars)/i.test(t);
  if (!hasUsd && hasArs) return null;
  if (!hasUsd && !/\d/.test(t)) return null;

  // Tomamos el primer número grande del texto.
  const match = t.match(/(\d[\d.\,]{2,})/);
  if (!match) return null;

  const num = parseNumber(match[1]);
  if (num == null || num < 1000) return null; // descarta expensas u otros valores chicos
  return num;
}

/** Convierte "250.000" / "250,000" / "1.250.000" a número entero. */
export function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // En es-AR el separador de miles es punto; removemos puntos y comas (no hay decimales en precios).
  const digits = cleaned.replace(/[.,]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrae superficie total en m². Prioriza superficie total sobre cubierta.
 * Maneja: "120 m²", "120 m2", "120 m² tot.", "Sup. total 120 m²".
 */
export function parseSurfaceM2(text: string | null | undefined): number | null {
  if (!text) return null;
  // OJO: sin \b al final. El "²" no es carácter de palabra, así que "\bm²\b"
  // nunca matchearía "87 m²" (sí "87 m2"). Zonaprop usa "m²".
  const matches = [...text.matchAll(/(\d{1,5})(?:[.,]\d+)?\s*m(?:²|2)(?![a-z\d])/gi)];
  if (matches.length === 0) return null;
  // El primer valor suele ser superficie total en las cards de Zonaprop.
  const values = matches.map((m) => Number(m[1])).filter((n) => n > 0 && n < 100000);
  if (values.length === 0) return null;
  // Tomamos el mayor (total >= cubierta) para representar la superficie comparable.
  return Math.max(...values);
}

/**
 * Estima días publicados a partir de textos tipo "Publicado hace 45 días",
 * "Publicado hoy", "Publicado ayer", "Publicado hace más de 1 año".
 */
export function parseDaysPublished(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase();

  if (/public[oa].{0,12}hoy/.test(t)) return 0;
  if (/public[oa].{0,12}ayer/.test(t)) return 1;

  const año = t.match(/hace\s+(?:m[aá]s de\s+)?(\d+)\s*a[ñn]os?/);
  if (año) return Number(año[1]) * 365;

  const mes = t.match(/hace\s+(?:m[aá]s de\s+)?(\d+)\s*mes/);
  if (mes) return Number(mes[1]) * 30;

  const dia = t.match(/hace\s+(?:m[aá]s de\s+)?(\d+)\s*d[ií]as?/);
  if (dia) return Number(dia[1]);

  const sem = t.match(/hace\s+(?:m[aá]s de\s+)?(\d+)\s*semanas?/);
  if (sem) return Number(sem[1]) * 7;

  return null;
}

/** Detecta tipo de propiedad a partir de título/URL. */
export function parsePropertyType(text: string | null | undefined): PropertyType | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\bcasas?\b|chalet|ph\b/.test(t)) return 'casa';
  if (/\bdepartamentos?\b|\bdepto/.test(t)) return 'departamento';
  return null;
}

/**
 * Normaliza un nombre de barrio/localidad a un slug usable en URLs de Zonaprop.
 * "Nordelta, Tigre" -> "nordelta". "Tigre" -> "tigre".
 */
export function slugifyNeighborhood(name: string): string {
  // Tomamos el segmento más específico (el primero antes de la coma).
  const first = name.split(',')[0] ?? name;
  return first
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Mediana de una lista de números. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Promedio de una lista de números. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
