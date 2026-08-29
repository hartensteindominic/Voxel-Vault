export default function sitemap() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');
  const now = new Date();
  const routes = [
    { path: '/', changeFrequency: 'daily', priority: 1 },
    { path: '/property', changeFrequency: 'daily', priority: 0.95 },
    { path: '/world', changeFrequency: 'daily', priority: 0.8 },
    { path: '/vault', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/privacy', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'monthly', priority: 0.3 },
  ];
  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
