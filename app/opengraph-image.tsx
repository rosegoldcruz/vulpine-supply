import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px',
          background: 'linear-gradient(135deg, #111111 0%, #2a2a22 55%, #ee7200 100%)',
          color: '#f5f0eb',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>Vulpine Homes</div>
        <div style={{ marginTop: 18, fontSize: 40, fontWeight: 500, lineHeight: 1.25 }}>
          Cabinet &amp; Interior Finish Supply - Arizona
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
