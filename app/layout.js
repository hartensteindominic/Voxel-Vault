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
    default: 'Voxel Vault | Spatial Asset OS',
    template: '%s | Voxel Vault',
  },
  description: 'Create 3D assets, explore source-backed real places, organize digital and provider-backed holdings, observe reported income and use clearly separated ownership workflows in one spatial app.',
  keywords: ['spatial assets', '3D creation', 'real estate digital twin', 'tokenized real estate', 'digital assets', 'Voxel Vault'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: {
    icon: '/voxelpop/voxelpop-logo.png',
    apple: '/voxelpop/voxelpop-logo.png',
  },
  openGraph: {
    title: 'Voxel Vault | Spatial Asset OS',
    description: 'One organized spatial home for 3D creation, real-world exploration, digital assets, provider-backed finance and ownership workflows.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: '/voxelpop/voxelpop-logo.png', alt: 'Voxel Vault' }],
  },
  twitter: {
    card: 'summary',
    title: 'Voxel Vault | Spatial Asset OS',
    description: 'Create, explore, organize and verify spatial assets from one app.',
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
