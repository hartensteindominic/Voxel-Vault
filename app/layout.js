import { WalletIdentityProvider } from './components/WalletIdentity';
import './vault-fallback.css';
import './futuristic-vault.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Voxel Vault | Real Products with Digital Twins Included',
    template: '%s | Voxel Vault',
  },
  description: 'Browse real products in a 3D-first storefront, pay normally, receive the physical item, and get its matching digital twin included. No crypto knowledge required.',
  keywords: ['Voxel Vault','digital twin included','physical product with digital twin','interactive 3D collectible','3D product marketplace','CJdropshipping 3D products'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Voxel Vault | Real Products with Digital Twins Included',
    description: 'One normal purchase: a real physical product shipped to you with its matching interactive 3D collectible included.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: `${SITE_URL}/api/og`, width: 1200, height: 630, alt: 'Voxel Vault real products and digital twins' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voxel Vault | Real Products with Digital Twins Included',
    description: 'Buy the real product. Keep its interactive digital twin. No crypto knowledge required.',
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
