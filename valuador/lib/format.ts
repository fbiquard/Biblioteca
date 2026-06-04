import type { VerdictLabel } from './types';

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatM2(n: number): string {
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)} m²`;
}

export function formatPricePerM2(n: number): string {
  return `${formatUsd(n)}/m²`;
}

export function formatPercent(ratio: number): string {
  const pct = ratio * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export const VERDICT_META: Record<
  VerdictLabel,
  { text: string; emoji: string; colorClass: string; bgClass: string; ringClass: string }
> = {
  SUBVALUADA: {
    text: 'Subvaluada',
    emoji: '🟢',
    colorClass: 'text-verdict-under',
    bgClass: 'bg-verdict-under/10',
    ringClass: 'ring-verdict-under/40',
  },
  PRECIO_JUSTO: {
    text: 'Precio justo',
    emoji: '🟡',
    colorClass: 'text-verdict-fair',
    bgClass: 'bg-verdict-fair/10',
    ringClass: 'ring-verdict-fair/40',
  },
  CARA: {
    text: 'Cara',
    emoji: '🔴',
    colorClass: 'text-verdict-over',
    bgClass: 'bg-verdict-over/10',
    ringClass: 'ring-verdict-over/40',
  },
};
