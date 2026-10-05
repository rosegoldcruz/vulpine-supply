/** @type {import('next').NextConfig} */
const nextConfig = {
  // /api/ar-model builds the Scene Viewer GLB from the configurator assets on disk
  outputFileTracingIncludes: {
    '/api/ar-model/[name]': [
      './public/models/configurator/**/*',
      './node_modules/draco3dgltf/**/*',
    ],
    // design summary PDF (@react-pdf -> pdfkit) loads its standard fonts with a dynamic require
    '/api/contact': ['./node_modules/pdfkit/js/standard-fonts/**/*', './node_modules/pdfkit/js/data/**/*'],
    '/api/request-bid': ['./node_modules/pdfkit/js/standard-fonts/**/*', './node_modules/pdfkit/js/data/**/*'],
    '/api/design-summary': ['./node_modules/pdfkit/js/standard-fonts/**/*', './node_modules/pdfkit/js/data/**/*'],
  },
  serverExternalPackages: ['draco3dgltf'],
  async redirects() {
    return [{ source: '/configurator/:path*', destination: '/visualizer/:path*', permanent: true }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            // camera + xr-spatial-tracking for "View in your space" (WebXR AR on Android); the rest stay off
            value: 'camera=(self), microphone=(), geolocation=(), xr-spatial-tracking=(self)',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
