'use client';

import { useState } from 'react';
import { OpportunityList } from '@/components/OpportunityList';
import { ScanForm } from '@/components/ScanForm';
import type { ScanFilters, ScanResult } from '@/lib/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleScan(filters: ScanFilters) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo completar la búsqueda.');
        return;
      }
      setResult(data as ScanResult);
    } catch {
      setError('No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Radar de <span className="text-verdict-under">oportunidades</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
          Cargá tus criterios y tu precio/m² de referencia. Escaneamos Zonaprop y te traemos los
          avisos que están por debajo del mercado de tu subzona en zona norte.
        </p>
      </header>

      <ScanForm onScan={handleScan} loading={loading} />

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-verdict-over/40 bg-verdict-over/10 p-4 text-sm text-verdict-over"
        >
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="mt-8 text-center text-sm text-neutral-400">
          <p>Escaneando avisos de la zona…</p>
          <p className="mt-1 text-xs text-neutral-600">Puede tardar unos segundos.</p>
        </div>
      )}

      {result && !loading && (
        <div className="mt-8">
          <OpportunityList result={result} />
        </div>
      )}

      <footer className="mt-auto pt-10 text-center text-xs text-neutral-700">
        Herramienta para inmobiliarios · los datos son de avisos publicados y dependen de la
        disponibilidad de los portales.
      </footer>
    </main>
  );
}
