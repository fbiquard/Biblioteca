'use client';

import { useEffect, useState } from 'react';
import { AnalyzeForm } from '@/components/AnalyzeForm';
import { BenchmarkDetails } from '@/components/BenchmarkDetails';
import { HistoryList } from '@/components/HistoryList';
import { VerdictCard } from '@/components/VerdictCard';
import {
  clearHistory,
  deleteHistory,
  loadHistory,
  saveHistory,
  toHistoryEntry,
} from '@/lib/history';
import type { AnalysisResult, HistoryEntry } from '@/lib/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    loadHistory().then(setHistory).catch(() => {});
  }, []);

  async function handleAnalyze(url: string) {
    if (!url) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo analizar la propiedad.');
        return;
      }

      const analysis = data as AnalysisResult;
      setResult(analysis);
      const updated = await saveHistory(toHistoryEntry(analysis));
      setHistory(updated);
    } catch {
      setError('No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setHistory(await deleteHistory(id));
  }

  async function handleClear() {
    await clearHistory();
    setHistory([]);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-10 sm:py-16">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          ¿Está <span className="text-verdict-under">subvaluada</span>?
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
          Pegá el link de una propiedad y comparala contra el mercado real de su subzona en zona
          norte de Buenos Aires.
        </p>
      </header>

      {/* Input principal */}
      <AnalyzeForm onAnalyze={handleAnalyze} loading={loading} />

      {/* Estado de error */}
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-verdict-over/40 bg-verdict-over/10 p-4 text-sm text-verdict-over"
        >
          {error}
        </div>
      )}

      {/* Estado de carga */}
      {loading && !error && (
        <div className="mt-6 space-y-3 text-center text-sm text-neutral-400">
          <p>Scrapeando la propiedad y ~20 comparables de la zona…</p>
          <p className="text-xs text-neutral-600">Esto puede tardar unos segundos.</p>
        </div>
      )}

      {/* Resultado */}
      {result && !loading && (
        <div className="mt-6 space-y-4">
          <VerdictCard result={result} />
          <BenchmarkDetails benchmark={result.benchmark} />
        </div>
      )}

      {/* Historial */}
      <HistoryList
        entries={history}
        onSelect={handleAnalyze}
        onDelete={handleDelete}
        onClear={handleClear}
      />

      <footer className="mt-auto pt-10 text-center text-xs text-neutral-700">
        Herramienta personal · los datos son estimativos y dependen de la disponibilidad de los
        portales.
      </footer>
    </main>
  );
}
