'use client';

import { useState } from 'react';
import type { Benchmark } from '@/lib/types';
import { formatM2, formatPricePerM2, formatUsd } from '@/lib/format';

export function BenchmarkDetails({ benchmark }: { benchmark: Benchmark }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-sm text-neutral-300">
          Muestra comparativa ·{' '}
          <strong className="text-neutral-100">{benchmark.sampleSize}</strong> propiedades similares
        </span>
        <span className="text-neutral-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Mini label="Promedio /m²" value={formatPricePerM2(benchmark.avgPricePerM2)} />
            <Mini label="Mediana /m²" value={formatPricePerM2(benchmark.medianPricePerM2)} />
            <Mini
              label="Scrapeadas"
              value={`${benchmark.scrapedCount} (±20% sup.: ${benchmark.sampleSize})`}
            />
          </div>

          <a
            href={benchmark.searchUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
          >
            Ver búsqueda en Zonaprop ↗
          </a>

          <ul className="mt-3 divide-y divide-neutral-800/70">
            {benchmark.comparables.map((c, i) => {
              const row = (
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-neutral-400">
                    {formatM2(c.surfaceM2)} · {formatUsd(c.priceUsd)}
                  </span>
                  <span className="font-medium text-neutral-200">
                    {formatPricePerM2(Math.round(c.pricePerM2))}
                  </span>
                </div>
              );
              return (
                <li key={c.url ?? i}>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="block hover:bg-neutral-800/30">
                      {row}
                    </a>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 font-semibold text-neutral-100">{value}</div>
    </div>
  );
}
