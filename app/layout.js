import { WalletIdentityProvider } from './components/WalletIdentity';
import FinancialOSNav from './components/FinancialOSNav';
import AppCommandCenter from './components/AppCommandCenter';
import ConsumerFooter from './components/ConsumerFooter';
import './vault-fallback.css';
import './futuristic-vault.css';
import './spatial-os-interactions.css';
import './voxelpop-cute-system.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Voxel Vault | Turn a House Photo into 3D', template: '%s | Voxel Vault' },
  description: 'Upload a property photo, see a 3D preview, turn it into a movable VoxelPop voxel, and mint only if you want. One $4.99 digital creation; the source photo stays on your device.',
  keywords: ['photo to 3D', 'house 3D creator', 'voxel creator', 'property visualization', 'VoxelPop', 'Voxel Vault'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: { icon: '/voxelpop/voxelpop-logo.png', apple: '/voxelpop/voxelpop-logo.png' },
  openGraph: {
    title: 'Voxel Vault | Photo → 3D → Voxel',
    description: 'See your property photo in 3D first, approve it, then build a movable voxel. Minting is optional.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: '/voxelpop/voxelpop-logo.png', alt: 'Voxel Vault VoxelPop' }],
  },
  twitter: {
    card: 'summary',
    title: 'Voxel Vault | Photo → 3D → Voxel',
    description: 'Upload a house photo, see the 3D preview, create the voxel, mint only if you want.',
    images: ['/voxelpop/voxelpop-logo.png'],
  },
};

export const viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffaf0' },
    { media: '(prefers-color-scheme: dark)', color: '#fffaf0' },
  ],
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><WalletIdentityProvider>{children}<ConsumerFooter/><AppCommandCenter/><FinancialOSNav/></WalletIdentityProvider></body></html>;
}
