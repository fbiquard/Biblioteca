import { NextResponse } from 'next/server';
import { AnalysisError, toAnalysisError } from '@/lib/errors';
import { scanOpportunities } from '@/lib/scraper/opportunities';
import type { PropertyType, ScanFilters } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let filters: ScanFilters;
  try {
    const body = await request.json();
    filters = parseFilters(body);
  } catch (err) {
    if (err instanceof AnalysisError) return errorResponse(err);
    return errorResponse(new AnalysisError('INVALID_URL', 'Parámetros inválidos.'));
  }

  try {
    const result = await scanOpportunities(filters);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(toAnalysisError(err));
  }
}

function parseFilters(body: unknown): ScanFilters {
  const b = (body ?? {}) as Record<string, unknown>;

  const zona = typeof b.zona === 'string' ? b.zona.trim() : '';
  if (!zona) throw new AnalysisError('INVALID_URL', 'Falta la zona.');

  const propertyType: PropertyType = b.propertyType === 'casa' ? 'casa' : 'departamento';

  const ambientesNum = Number(b.ambientes);
  const ambientes = Number.isFinite(ambientesNum) && ambientesNum > 0 ? Math.floor(ambientesNum) : null;

  const refPricePerM2 = Number(b.refPricePerM2);
  if (!Number.isFinite(refPricePerM2) || refPricePerM2 <= 0) {
    throw new AnalysisError('INVALID_URL', 'Ingresá un precio/m² de referencia válido.');
  }

  const minPrice = positiveOrNull(b.minPrice);
  const maxPrice = positiveOrNull(b.maxPrice);

  return { zona, propertyType, ambientes, refPricePerM2, minPrice, maxPrice };
}

function positiveOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function errorResponse(err: AnalysisError) {
  return NextResponse.json(
    { error: { code: err.code, message: err.userMessage } },
    { status: err.httpStatus },
  );
}
