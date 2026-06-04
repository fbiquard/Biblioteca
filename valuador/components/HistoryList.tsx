'use client';

import type { HistoryEntry } from '@/lib/types';
import { VERDICT_META, formatDate, formatPercent, formatPricePerM2 } from '@/lib/format';

interface Props {
  entries: HistoryEntry[];
  onSelect: (url: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryList({ entries, onSelect, onDelete, onClear }: Props) {
  if (entries.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Historial
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-neutral-500 transition hover:text-verdict-over"
        >
          Vaciar
        </button>
      </div>

      <ul className="space-y-2">
        {entries.map((e) => {
          const meta = VERDICT_META[e.verdict];
          return (
            <li
              key={e.id}
              className="group flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"
            >
              <span className="text-lg" title={meta.text}>
                {meta.emoji}
              </span>
              <button
                onClick={() => onSelect(e.url)}
                className="min-w-0 flex-1 text-left"
                title="Volver a analizar"
              >
                <div className="truncate text-sm text-neutral-200">
                  {e.title ?? e.neighborhood ?? e.url}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                  <span>{e.neighborhood ?? 'Zona N/D'}</span>
                  <span>{formatPricePerM2(e.pricePerM2)}</span>
                  <span className={meta.colorClass}>{formatPercent(e.deviation)}</span>
                  <span>{formatDate(e.analyzedAt)}</span>
                </div>
              </button>
              <button
                onClick={() => onDelete(e.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-neutral-600 opacity-0 transition hover:text-verdict-over group-hover:opacity-100"
                aria-label="Eliminar del historial"
                title="Eliminar"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
