import { WalletIdentityProvider } from './components/WalletIdentity';
import FinancialOSNav from './components/FinancialOSNav';
import AppCommandCenter from './components/AppCommandCenter';
import './vault-fallback.css';
import './futuristic-vault.css';
import './spatial-os-interactions.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Voxel Vault | 3D Property + Digital Assets',
    template: '%s | Voxel Vault',
  },
  description: 'Create digital property voxels, explore source-backed places in 3D, organize digital assets, and use clearly labeled demo, provider-backed, and title-based property workflows.',
  keywords: ['3D property', 'digital property', 'voxel assets', 'real estate digital twin', 'digital collectibles', 'Voxel Vault'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: {
    icon: '/voxelpop/voxelpop-logo.png',
    apple: '/voxelpop/voxelpop-logo.png',
  },
  openGraph: {
    title: 'Voxel Vault | 3D Property + Digital Assets',
    description: 'Create digital property voxels, explore real places in source-backed 3D, and keep digital, demo, provider-backed, and title-based workflows clearly separated.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: '/voxelpop/voxelpop-logo.png', alt: 'Voxel Vault' }],
  },
  twitter: {
    card: 'summary',
    title: 'Voxel Vault | 3D Property + Digital Assets',
    description: 'Create, explore, collect, and organize digital property assets with clear product-status boundaries.',
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
          <AppCommandCenter />
          <FinancialOSNav />
        </WalletIdentityProvider>
      </body>
    </html>
  );
}
