'use client';

import type { AnalysisResult } from '@/lib/types';
import {
  VERDICT_META,
  formatM2,
  formatPercent,
  formatPricePerM2,
  formatUsd,
} from '@/lib/format';

export function VerdictCard({ result }: { result: AnalysisResult }) {
  const { property, benchmark, verdict } = result;
  const meta = VERDICT_META[verdict.label];

  // Para el veredicto, un desvío negativo (más barata que el mercado) es bueno.
  const deviationGood = verdict.deviation < 0;

  return (
    <section
      className={`rounded-2xl border border-neutral-800 ${meta.bgClass} p-6 ring-1 ${meta.ringClass}`}
    >
      {/* Veredicto principal */}
      <div className="flex flex-col items-center text-center">
        <span className="text-sm uppercase tracking-widest text-neutral-400">Veredicto</span>
        <h2 className={`mt-1 text-4xl font-black ${meta.colorClass}`}>
          {meta.emoji} {meta.text}
        </h2>
        <p className="mt-2 text-sm text-neutral-300">
          Está{' '}
          <strong className={meta.colorClass}>
            {formatPercent(verdict.deviation)}
          </strong>{' '}
          {deviationGood ? 'por debajo' : 'por encima'} del valor de mercado de su subzona
        </p>
      </div>

      {/* Comparación de precio por m² */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat
          label="Precio / m² propiedad"
          value={formatPricePerM2(verdict.pricePerM2)}
          accent={meta.colorClass}
        />
        <Stat
          label="Mercado (mediana subzona)"
          value={formatPricePerM2(benchmark.medianPricePerM2)}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Precio publicado" value={formatUsd(property.priceUsd)} />
        <Stat label="Superficie" value={formatM2(property.surfaceM2)} />
      </div>

      {/* Señal secundaria: días publicada */}
      {verdict.daysSignal && (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Tiempo publicada</span>
            <span className="font-semibold text-neutral-200">
              {verdict.daysSignal.propertyDays} días · zona ~{verdict.daysSignal.avgDays} días
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">{verdict.daysSignal.message}</p>
        </div>
      )}

      {property.title && (
        <a
          href={property.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block truncate text-center text-sm text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
          title={property.title}
        >
          {property.title}
        </a>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent ?? 'text-neutral-100'}`}>{value}</div>
    </div>
  );
}
