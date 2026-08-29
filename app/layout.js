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
  title: { default: 'Voxel Vault | 3D Property + Digital Assets', template: '%s | Voxel Vault' },
  description: 'Your 3D Asset Vault for paid digital VoxelPop creations, source-backed property maps, digital collectibles, and clearly separated sandbox, provider-backed, and title-based property workflows.',
  keywords: ['3D property', 'voxel creator', 'digital property', 'NFT vault', 'real estate digital twin', 'digital assets', 'Voxel Vault'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: { icon: '/voxelpop/voxelpop-logo.png', apple: '/voxelpop/voxelpop-logo.png' },
  openGraph: {
    title: 'Voxel Vault | 3D Property + Digital Assets',
    description: 'Create digital VoxelPop property assets, explore source-backed places in 3D, and keep digital assets, sandbox tools, provider positions, and real-property title clearly separated.',
    type: 'website', url: SITE_URL, siteName: 'Voxel Vault', images: [{ url: '/voxelpop/voxelpop-logo.png', alt: 'Voxel Vault' }],
  },
  twitter: { card: 'summary', title: 'Voxel Vault | 3D Property + Digital Assets', description: 'Create, map, collect, and organize digital property assets with clear ownership boundaries.', images: ['/voxelpop/voxelpop-logo.png'] },
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
    <html lang="en"><body><WalletIdentityProvider>{children}<AppCommandCenter /><FinancialOSNav /></WalletIdentityProvider></body></html>
  );
}
