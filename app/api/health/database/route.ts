import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { db } from '../../../../lib/db/client';
import { getDatabaseUrl } from '../../../../lib/db/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getDatabaseUrl();
    await db.execute(sql`select 1`);

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    console.error('[database-health]', error instanceof Error ? error.message : error);

    return NextResponse.json(
      {
        status: 'error',
        database: 'unavailable',
      },
      { status: 503 },
    );
  }
}
