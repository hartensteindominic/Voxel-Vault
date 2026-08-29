export default function sitemap() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');
  const routes = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/demo', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/property', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/world', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/more', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/privacy', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/terms', changeFrequency: 'monthly', priority: 0.4 },
  ];
  return routes.map((route) => ({
    url: `${base}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
