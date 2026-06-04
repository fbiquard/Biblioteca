'use client';

import { useState } from 'react';
import { Spinner } from './Spinner';

interface Props {
  onAnalyze: (url: string) => void;
  loading: boolean;
}

export function AnalyzeForm({ onAnalyze, loading }: Props) {
  const [url, setUrl] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    onAnalyze(url.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label htmlFor="url" className="sr-only">
        URL de la propiedad
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Pegá el link de Zonaprop o Argenprop…"
          disabled={loading}
          className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-base text-neutral-100 placeholder:text-neutral-500 outline-none transition focus:border-verdict-under/60 focus:ring-2 focus:ring-verdict-under/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-verdict-under px-6 py-3 font-semibold text-neutral-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner className="h-4 w-4" />
              Analizando…
            </>
          ) : (
            'Analizar'
          )}
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Casas y departamentos en venta · Tigre y zona norte GBA · precios en USD
      </p>
    </form>
  );
}
