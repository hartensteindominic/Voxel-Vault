import { NextResponse } from 'next/server';
import { BankingError } from './banking';

export function bankingJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache'
    }
  });
}

export function bankingErrorResponse(error: unknown) {
  if (error instanceof BankingError) {
    return bankingJson({
      ok: false,
      error: {
        code: error.code,
        message: error.message
      }
    }, error.status);
  }

  console.error('Unexpected banking API error', error);
  return bankingJson({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Banking service is temporarily unavailable.'
    }
  }, 500);
}
