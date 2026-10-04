/** @type {import('next').NextConfig} */
const nextConfig = {
  // /api/ar-model builds the Scene Viewer GLB from the configurator assets on disk
  outputFileTracingIncludes: {
    '/api/ar-model/[name]': [
      './public/models/configurator/**/*',
      './node_modules/draco3dgltf/**/*',
    ],
  },
  serverExternalPackages: ['draco3dgltf'],
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
