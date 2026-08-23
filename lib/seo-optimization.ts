// Voxel Vault SEO optimization - meta tags, structured data, Open Graph

export interface SEOMeta {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
}

export function generateProductMeta(product: any): SEOMeta {
  return {
    title: `${product.name} - 3D Digital Twin NFT | Voxel Vault`,
    description: `Buy ${product.name} + get the exclusive 3D digital NFT. Own both the physical product and its digital twin with blockchain verification.`,
    keywords: [product.name, 'digital twin', '3D NFT', 'collectible', product.brand || 'product', 'Web3'],
    ogImage: product.modelEmbedUrl || '',
    ogType: 'product',
    canonicalUrl: `https://voxelvault.io/product/${product.id}`,
  };
}

export function generateStructuredData(product: any): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: `${product.name} with exclusive 3D digital twin NFT included`,
    image: product.modelEmbedUrl || '',
    brand: {
      '@type': 'Brand',
      name: product.brand || 'Voxel Vault',
    },
    offers: {
      '@type': 'Offer',
      price: product.priceUsd,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };
}