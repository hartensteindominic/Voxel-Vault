import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: 'https://orxyz.xyz/',
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://orxyz.xyz/privacy',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: 'https://orxyz.xyz/terms',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
