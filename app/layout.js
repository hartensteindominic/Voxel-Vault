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
  title: { default: 'Voxel Vault | Turn a Property Photo into a 3D Voxel', template: '%s | Voxel Vault' },
  description: 'Upload an authorized property photo, see a recognizable 3D preview, approve it, then build a movable VoxelPop voxel for $4.99. The source photo stays on your device during normal creation and minting is optional.',
  keywords: ['property photo to 3D', '3D house creator', 'voxel house', 'VoxelPop', 'property voxel', 'digital property art'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: { icon: '/voxelpop/voxelpop-logo.png', apple: '/voxelpop/voxelpop-logo.png' },
  openGraph: {
    title: 'Voxel Vault | Property Photo → 3D Preview → Voxel',
    description: 'See the 3D result first. Approve it. Then build your movable VoxelPop voxel. One digital creation is $4.99 and minting is optional.',
    type: 'website', url: SITE_URL, siteName: 'Voxel Vault', images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Voxel Vault property photo to 3D voxel workflow' }],
  },
  twitter: { card: 'summary_large_image', title: 'Voxel Vault | Property Photo → 3D Preview → Voxel', description: 'Turn an authorized property photo into a reviewed 3D preview and movable voxel for $4.99.', images: ['/opengraph-image'] },
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
