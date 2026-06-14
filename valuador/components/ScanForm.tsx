'use client';

import { useState } from 'react';
import type { PropertyType, ScanFilters } from '@/lib/types';
import { Spinner } from './Spinner';

interface Props {
  onScan: (filters: ScanFilters) => void;
  loading: boolean;
}

export function ScanForm({ onScan, loading }: Props) {
  const [zona, setZona] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('departamento');
  const [ambientes, setAmbientes] = useState<string>(''); // '' = cualquiera
  const [ref, setRef] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const refNum = Number(ref);
    if (!zona.trim() || !Number.isFinite(refNum) || refNum <= 0) return;
    const toNum = (s: string) => (s && Number(s) > 0 ? Number(s) : null);
    onScan({
      zona: zona.trim(),
      propertyType,
      ambientes: ambientes ? Number(ambientes) : null,
      refPricePerM2: refNum,
      minPrice: toNum(minPrice),
      maxPrice: toNum(maxPrice),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo */}
      <div className="grid grid-cols-2 gap-2">
        <TypeButton active={propertyType === 'departamento'} onClick={() => setPropertyType('departamento')}>
          🏢 Departamento
        </TypeButton>
        <TypeButton active={propertyType === 'casa'} onClick={() => setPropertyType('casa')}>
          🏠 Casa
        </TypeButton>
      </div>

      {/* Zona */}
      <Field label="Zona / barrio">
        <input
          type="text"
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          placeholder="Ej: Tigre, Nordelta, San Isidro…"
          disabled={loading}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        {/* Ambientes */}
        <Field label="Ambientes">
          <select
            value={ambientes}
            onChange={(e) => setAmbientes(e.target.value)}
            disabled={loading}
            className={inputClass}
          >
            <option value="">Cualquiera</option>
            <option value="1">1 ambiente</option>
            <option value="2">2 ambientes</option>
            <option value="3">3 ambientes</option>
            <option value="4">4 ambientes</option>
            <option value="5">5+ ambientes</option>
          </select>
        </Field>

        {/* Precio m2 referencia */}
        <Field
          label={
            propertyType === 'casa' ? 'Tu precio/m² TERRENO (USD)' : 'Tu precio/m² ref. (USD)'
          }
        >
          <input
            type="number"
            inputMode="numeric"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={propertyType === 'casa' ? 'Ej: 700' : 'Ej: 2200'}
            disabled={loading}
            className={inputClass}
          />
        </Field>
      </div>

      {/* Rango de precio total (USD) — opcional */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio mín. (USD)">
          <input
            type="number"
            inputMode="numeric"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Sin mínimo"
            disabled={loading}
            className={inputClass}
          />
        </Field>
        <Field label="Precio máx. (USD)">
          <input
            type="number"
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Sin máximo"
            disabled={loading}
            className={inputClass}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={loading || !zona.trim() || !ref}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-verdict-under px-6 py-3 font-semibold text-neutral-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Spinner className="h-4 w-4" /> Buscando oportunidades…
          </>
        ) : (
          'Buscar oportunidades'
        )}
      </button>
      <p className="text-center text-xs text-neutral-500">
        Trae los avisos en venta cuyo precio/m² está por debajo de tu referencia.
      </p>
    </form>
  );
}

const inputClass =
  'w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-base text-neutral-100 placeholder:text-neutral-500 outline-none transition focus:border-verdict-under/60 focus:ring-2 focus:ring-verdict-under/20 disabled:opacity-60';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

function TypeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
        active
          ? 'border-verdict-under/60 bg-verdict-under/10 text-verdict-under'
          : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );
}
