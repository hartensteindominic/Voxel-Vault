import { WalletIdentityProvider } from './components/WalletIdentity';
import FinancialOSNav from './components/FinancialOSNav';
import './vault-fallback.css';
import './voxelpop-cute-system.css';
import './ui-system.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

const TITLE = 'VoxelPop | Photo in. Voxel out.';
const DESCRIPTION = 'Turn a house photo into a 3D VoxelPop for $4.99. Approve the voxel photo, then get a movable 3D voxel. Saved to Vault. Mint optional.';

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
  return <html lang="en"><body><WalletIdentityProvider>{children}<FinancialOSNav/></WalletIdentityProvider></body></html>;
}
