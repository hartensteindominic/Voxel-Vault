import { WalletIdentityProvider } from './components/WalletIdentity';
import FinancialOSNav from './components/FinancialOSNav';
import AppCommandCenter from './components/AppCommandCenter';
import ConsumerFooter from './components/ConsumerFooter';
import './vault-fallback.css';
import './futuristic-vault.css';
import './spatial-os-interactions.css';
import './voxelpop-cute-system.css';
import './ui-system.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

const TITLE = 'Voxel Vault | House Photo to VoxelPop 3D House & Voxel';
const DESCRIPTION = 'Turn an authorized house photo into a VoxelPop/NFT-house-style generated 3D image for $4.99, approve that image, then create the separate movable 3D voxel. Minting is optional.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Voxel Vault' },
  description: DESCRIPTION,
  keywords: ['house photo to 3D', 'VoxelPop house', 'NFT house creator', 'voxel house creator', '3D house image', 'Voxel Vault'],
  robots: { index: true, follow: true },
  icons: { icon: '/voxelpop/voxelpop-logo.png', apple: '/voxelpop/voxelpop-logo.png' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'VoxelPop house photo to generated 3D house and movable voxel' }],
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
  return <html lang="en"><body><WalletIdentityProvider>{children}<ConsumerFooter/><AppCommandCenter/><FinancialOSNav/></WalletIdentityProvider></body></html>;
}
