import { parseConfig } from '@/components/configurator/summary';
import { enforceRateLimit, logFailure, RequestError } from '@/lib/request-security';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** GET /api/design-summary?style=...&color=...&hw=...&finish=... -> the design summary PDF (same file the quote emails attach). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await enforceRateLimit(request, 'design-summary', 20, 60);
    const { renderDesignSummaryPdf } = await import('@/lib/design-summary-pdf');
    const { pdf, details } = await renderDesignSummaryPdf(parseConfig(url.searchParams), {
      assets: { origin: url.origin, cookie: request.headers.get('cookie') || '' },
    });
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Vulpine-Design-Summary-${details.ref}.pdf"`,
        'Cache-Control': 'public, max-age=0, s-maxage=3600',
      },
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    logFailure('[design-summary] PDF render failed:', error);
    return Response.json({ ok: false, error: 'Could not build the PDF right now.' }, { status: 500 });
  }
}
