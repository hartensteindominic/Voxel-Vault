import { WalletIdentityProvider } from './components/WalletIdentity';
import FinancialOSNav from './components/FinancialOSNav';
import './vault-fallback.css';
import './futuristic-vault.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Voxel Vault | Spatial Financial OS',
    template: '%s | Voxel Vault',
  },
  description: 'Explore source-backed real places, connect provider-backed real-estate assets, organize verified holdings, observe reported income and plan a path toward direct property ownership.',
  keywords: ['spatial finance', 'real estate digital twin', 'tokenized real estate', '3D property', 'Voxel Vault'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: {
    icon: '/voxelpop/voxelpop-logo.png',
    apple: '/voxelpop/voxelpop-logo.png',
  },
  openGraph: {
    title: 'Voxel Vault | Spatial Financial OS',
    description: 'One spatial home for exploring real places, provider-backed assets, verified holdings, observed income and direct-property planning.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: '/voxelpop/voxelpop-logo.png', alt: 'Voxel Vault' }],
  },
  twitter: {
    card: 'summary',
    title: 'Voxel Vault | Spatial Financial OS',
    description: 'Explore, invest through connected providers, verify holdings, observe income and plan direct property ownership.',
    images: ['/voxelpop/voxelpop-logo.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#101a24' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletIdentityProvider>
          {children}
          <FinancialOSNav />
        </WalletIdentityProvider>
      </body>
    </html>
  );
}