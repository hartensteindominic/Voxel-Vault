export default function robots() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/bank'],
      disallow: [
        '/admin/', '/api/admin/', '/api/', '/vault/', '/account/', '/checkout/',
        '/property/', '/property', '/world/', '/world', '/demo/', '/demo',
        '/more/', '/more', '/about/', '/about', '/studio/', '/studio',
        '/voxelflip/', '/pack/'
      ],
    }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
