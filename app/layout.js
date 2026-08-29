import { WalletIdentityProvider } from './components/WalletIdentity';
import FinancialOSNav from './components/FinancialOSNav';
import AppCommandCenter from './components/AppCommandCenter';
import './vault-fallback.css';
import './futuristic-vault.css';
import './spatial-os-interactions.css';
import './voxelpop-cute-system.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Voxel Vault | Your 3D Asset Vault', template: '%s | Voxel Vault' },
  description: 'Create and collect 3D voxel assets, explore real places, organize NFTs and connected financial tools, and keep ownership status clear in one spatial app.',
  keywords: ['3D assets', 'voxel creator', 'NFT vault', 'spatial wallet', 'real estate digital twin', 'digital assets', 'Voxel Vault'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: { icon: '/voxelpop/voxelpop-logo.png', apple: '/voxelpop/voxelpop-logo.png' },
  openGraph: {
    title: 'Voxel Vault | Your 3D Asset Vault',
    description: 'A playful spatial home for 3D creation, NFTs, real-world exploration and connected financial tools.',
    type: 'website', url: SITE_URL, siteName: 'Voxel Vault', images: [{ url: '/voxelpop/voxelpop-logo.png', alt: 'Voxel Vault' }],
  },
  twitter: { card: 'summary', title: 'Voxel Vault | Your 3D Asset Vault', description: 'Create, explore, collect and organize spatial assets from one app.', images: ['/voxelpop/voxelpop-logo.png'] },
};

export const viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffaf0' },
    { media: '(prefers-color-scheme: dark)', color: '#fffaf0' },
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
