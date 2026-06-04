import { NextResponse } from 'next/server';
import { analyzeProperty } from '@/lib/analyze';
import { AnalysisError, toAnalysisError } from '@/lib/errors';

// Playwright necesita el runtime de Node (no edge) y tiempo para scrapear.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let url: string;
  try {
    const body = await request.json();
    url = typeof body?.url === 'string' ? body.url : '';
  } catch {
    return errorResponse(new AnalysisError('INVALID_URL'));
  }

  try {
    const result = await analyzeProperty(url);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(toAnalysisError(err));
  }
}

function errorResponse(err: AnalysisError) {
  return NextResponse.json(
    { error: { code: err.code, message: err.userMessage } },
    { status: err.httpStatus },
  );
}
