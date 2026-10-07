import { buildArGlb, parseArQuery } from '@/lib/ar-model';
import { enforceRateLimit, logFailure, RequestError } from '@/lib/request-security';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** GET /api/ar-model/<anything>.glb?style=&color=&hw=&finish=&doors=&island= -> GLB for Google Scene Viewer. */
export async function GET(request: Request) {
  const q = parseArQuery(new URL(request.url).searchParams);
  if (!q) return new Response('Bad configuration', { status: 400 });
  try {
    await enforceRateLimit(request, 'ar-model', 20, 60);
    const glb = await buildArGlb(q);
    return new Response(Buffer.from(glb), {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    if (e instanceof RequestError) return new Response(e.message, { status: e.status });
    logFailure('[ar-model] build failed', e);
    return new Response('Could not build the AR model', { status: 500 });
  }
}
