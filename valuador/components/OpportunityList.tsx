'use client';

import type { ScanResult } from '@/lib/types';
import { formatM2, formatPricePerM2, formatUsd } from '@/lib/format';

export function OpportunityList({ result }: { result: ScanResult }) {
  const { opportunities, scannedCount, filters } = result;

  return (
    <section className="space-y-4">
      {/* Resumen */}
      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>
          <strong className="text-neutral-100">{opportunities.length}</strong> oportunidad
          {opportunities.length === 1 ? '' : 'es'} · {scannedCount} avisos escaneados
        </span>
        <a
          href={result.searchUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline-offset-2 hover:text-neutral-200 hover:underline"
        >
          Ver en Zonaprop ↗
        </a>
      </div>

      {/* Vacío */}
      {opportunities.length === 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-400">
          No hay avisos por debajo de{' '}
          <strong className="text-neutral-200">{formatPricePerM2(filters.refPricePerM2)}</strong> en
          esta zona. Probá subir tu precio/m² de referencia o cambiar los filtros.
        </div>
      )}

      {/* Lista */}
      <ul className="space-y-2">
        {opportunities.map((op, i) => {
          const pct = Math.round(op.discountPct * 100);
          const card = (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 transition hover:border-verdict-under/40">
              <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-verdict-under/10 py-2">
                <span className="text-lg font-black text-verdict-under">-{pct}%</span>
                <span className="text-[10px] text-neutral-500">vs ref.</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-neutral-100">
                  {op.locationRaw ?? 'Ubicación N/D'}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-400">
                  <span className="font-medium text-neutral-200">{formatUsd(op.priceUsd)}</span>
                  <span>{formatM2(op.surfaceM2)}</span>
                  {op.ambientes ? <span>{op.ambientes} amb.</span> : null}
                  <span className="text-verdict-under">{formatPricePerM2(op.pricePerM2)}</span>
                </div>
              </div>
              {op.url && <span className="shrink-0 text-neutral-600">↗</span>}
            </div>
          );
          return (
            <li key={op.url ?? i}>
              {op.url ? (
                <a href={op.url} target="_blank" rel="noreferrer" className="block">
                  {card}
                </a>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
