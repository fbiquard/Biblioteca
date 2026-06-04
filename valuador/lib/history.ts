'use client';

import { getSupabase, isSupabaseEnabled } from './supabase';
import type { AnalysisResult, HistoryEntry } from './types';

const STORAGE_KEY = 'valuador:historial';
const MAX_ENTRIES = 50;
const SUPABASE_TABLE = 'valuations';

/** Convierte un resultado de análisis en una entrada de historial. */
export function toHistoryEntry(result: AnalysisResult): HistoryEntry {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: result.property.url,
    title: result.property.title,
    neighborhood: result.property.neighborhood,
    propertyType: result.property.propertyType,
    priceUsd: result.property.priceUsd,
    surfaceM2: result.property.surfaceM2,
    pricePerM2: result.verdict.pricePerM2,
    marketPricePerM2: result.benchmark.medianPricePerM2,
    deviation: result.verdict.deviation,
    verdict: result.verdict.label,
    analyzedAt: result.analyzedAt,
  };
}

// ---------- localStorage (siempre activo) ----------

function readLocal(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* cuota llena o modo privado: ignoramos */
  }
}

// ---------- API pública ----------

/** Carga el historial: prioriza Supabase si está configurado, con fallback local. */
export async function loadHistory(): Promise<HistoryEntry[]> {
  const local = readLocal();
  if (!isSupabaseEnabled) return local;

  const supabase = getSupabase();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .order('analyzedAt', { ascending: false })
    .limit(MAX_ENTRIES);

  if (error || !data) return local;
  // Sincronizamos copia local para uso offline.
  writeLocal(data as HistoryEntry[]);
  return data as HistoryEntry[];
}

/** Agrega una entrada al historial (local + Supabase si aplica). */
export async function saveHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const existing = readLocal().filter((e) => e.url !== entry.url);
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  writeLocal(updated);

  if (isSupabaseEnabled) {
    const supabase = getSupabase();
    await supabase?.from(SUPABASE_TABLE).upsert(entry, { onConflict: 'url' });
  }
  return updated;
}

/** Borra una entrada del historial. */
export async function deleteHistory(id: string): Promise<HistoryEntry[]> {
  const updated = readLocal().filter((e) => e.id !== id);
  writeLocal(updated);

  if (isSupabaseEnabled) {
    const supabase = getSupabase();
    await supabase?.from(SUPABASE_TABLE).delete().eq('id', id);
  }
  return updated;
}

/** Vacía todo el historial. */
export async function clearHistory(): Promise<void> {
  writeLocal([]);
  if (isSupabaseEnabled) {
    const supabase = getSupabase();
    await supabase?.from(SUPABASE_TABLE).delete().neq('id', '');
  }
}
