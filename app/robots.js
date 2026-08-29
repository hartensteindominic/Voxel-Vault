export default function robots() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/vault/', '/account/', '/checkout/', '/property/mint'],
    }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
