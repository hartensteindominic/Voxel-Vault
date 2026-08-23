// Performance optimizations for production deployment

// Image optimization helpers
export function getOptimizedImageUrl(
  originalUrl: string,
  width: number,
  format: 'webp' | 'avif' = 'webp'
): string {
  // Use Cloudinary, Imgix, or similar service
  const params = new URLSearchParams({
    w: width.toString(),
    f: format,
    q: '80',
    auto: 'format',
  });

  return `${originalUrl}?${params.toString()}`;
}

// 3D model lazy loading with intersection observer
export function createIntersectionObserver(
  element: HTMLElement,
  callback: () => void,
  options = {}
): IntersectionObserver {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback();
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '50px', ...options }
  );

  observer.observe(element);
  return observer;
}

// Request caching with stale-while-revalidate
export async function fetchWithCache(
  url: string,
  cacheDuration = 3600000 // 1 hour
): Promise<any> {
  const cacheKey = `cache_${Buffer.from(url).toString('base64')}`;
  const cached = localStorage?.getItem(cacheKey);

  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheDuration) {
        return data;
      }
    } catch (e) {
      // Ignore cache parse errors
    }
  }

  const response = await fetch(url);
  const data = await response.json();

  if (localStorage) {
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  }

  return data;
}

// Web worker for heavy computations
export function createWorker(scriptUrl: string): Worker {
  return new Worker(scriptUrl);
}
