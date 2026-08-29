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
  title: { default: 'Voxel Vault | Turn a House Photo into 3D', template: '%s | Voxel Vault' },
  description: 'Upload an authorized house photo, see a 3D preview, turn it into a movable VoxelPop voxel, save it to your World and Vault, and optionally mint the finished digital voxel.',
  keywords: ['house photo to 3D', 'voxel house', '3D property creator', 'VoxelPop', 'digital property', '3D voxel', 'Voxel Vault'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: { icon: '/voxelpop/voxelpop-logo.png', apple: '/voxelpop/voxelpop-logo.png' },
  openGraph: {
    title: 'Voxel Vault | See Your House in 3D',
    description: 'Photo → 3D preview → movable voxel → optional mint. Try the public sample before you sign in or pay.',
    type: 'website', url: SITE_URL, siteName: 'Voxel Vault',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voxel Vault | See Your House in 3D',
    description: 'Photo → 3D preview → movable voxel → optional mint. Try the public sample first.',
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
  return <html lang="en"><body><WalletIdentityProvider>{children}<AppCommandCenter /><FinancialOSNav /></WalletIdentityProvider></body></html>;
}
