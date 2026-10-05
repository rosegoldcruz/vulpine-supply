import { parseConfig } from '@/components/configurator/summary';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** GET /api/design-summary?style=...&color=...&hw=...&finish=... -> the design summary PDF (same file the quote emails attach). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
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
    console.error('[design-summary] PDF render failed:', error);
    return Response.json({ ok: false, error: 'Could not build the PDF right now.' }, { status: 500 });
  }
}
