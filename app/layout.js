import { WalletIdentityProvider } from './components/WalletIdentity';
import FinancialOSNav from './components/FinancialOSNav';
import AppCommandCenter from './components/AppCommandCenter';
import './vault-fallback.css';
import './voxelpop-cute-system.css';
import './ui-system.css';
import './spatial-os-interactions.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

const TITLE = 'VoxelPop | Turn a House Photo into a 3D Voxel Photo';
const DESCRIPTION = 'Turn a House Photo into a 3D Voxel Photo for $4.99. Approve the voxel photo, then get a movable 3D voxel. Source photo stays on your device; minting is optional. Saved to Vault.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | VoxelPop' },
  description: DESCRIPTION,
  keywords: ['VoxelPop', 'house photo to voxel', '3D voxel photo', 'voxel house creator', 'Voxel Vault'],
  robots: { index: true, follow: true },
  icons: { icon: '/voxelpop/voxelpop-logo.png', apple: '/voxelpop/voxelpop-logo.png' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: 'VoxelPop',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'VoxelPop photo to 3D voxel' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/opengraph-image'] },
};

export const viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffaf0' },
    { media: '(prefers-color-scheme: dark)', color: '#fffaf0' },
  ],
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><WalletIdentityProvider>{children}<FinancialOSNav/><AppCommandCenter/></WalletIdentityProvider></body></html>;
}
