import { WalletIdentityProvider } from './components/WalletIdentity';
import FinancialOSNav from './components/FinancialOSNav';
import AppCommandCenter from './components/AppCommandCenter';
import './vault-fallback.css';
import './voxelpop-cute-system.css';
import './ui-system.css';
import './spatial-os-interactions.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

const TITLE = 'Voxel Vault | Turn Property Photos into 3D Voxel Collectibles';
const DESCRIPTION = 'Take a property photo, confirm the address, build a 3D voxel collectible, save it to your Voxel Vault Inventory, and mint it when you want.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Voxel Vault' },
  description: DESCRIPTION,
  keywords: ['Voxel Vault', 'property voxel', 'house photo to voxel', '3D voxel collectible', 'property NFT'],
  robots: { index: true, follow: true },
  icons: { icon: '/voxelpop/voxelpop-logo.png', apple: '/voxelpop/voxelpop-logo.png' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Voxel Vault property photo to 3D voxel' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/opengraph-image'] },
};

export const viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f5ff' },
    { media: '(prefers-color-scheme: dark)', color: '#f8f5ff' },
  ],
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><WalletIdentityProvider>{children}<FinancialOSNav/><AppCommandCenter/></WalletIdentityProvider></body></html>;
}
