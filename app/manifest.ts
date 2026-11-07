import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Pilot | School Operations',
    short_name: 'Pilot',
    description: 'A connected school operations workspace.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f8fc',
    theme_color: '#536ac8',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
