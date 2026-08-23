import { WalletIdentityProvider } from './components/WalletIdentity';
import './vault-fallback.css';
import './futuristic-vault.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Voxel Vault | Real Products with 3D NFTs Included',
    template: '%s | Voxel Vault',
  },
  description: 'Buy a legitimate physical product and receive its authenticated interactive 3D NFT—no crypto required.',
  keywords: ['Voxel Vault','3D NFT included','physical product with digital twin','interactive 3D collectible','no crypto NFT'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Voxel Vault | Real Products with 3D NFTs Included',
    description: 'One normal purchase: a legitimate physical product shipped to you and its authenticated 3D NFT included.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: `${SITE_URL}/api/og`, width: 1200, height: 630, alt: 'Voxel Vault objects worth finding' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voxel Vault | Real Products with 3D NFTs Included',
    description: 'Buy the real product. Receive its interactive 3D NFT. No crypto required.',
    images: [`${SITE_URL}/api/og`],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletIdentityProvider>{children}</WalletIdentityProvider>
      </body>
    </html>
  );
}
