import { WalletIdentityProvider } from './components/WalletIdentity';
import VoxelPopHelpWidget from './components/VoxelPopHelpWidget';
import VoxelPopExitIntent from './components/VoxelPopExitIntent';
import './vault-fallback.css';
import './futuristic-vault.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VoxelPop 3D Generator | Your Idea, Made 3D for $1.99',
    template: '%s | VoxelPop',
  },
  description: 'Turn a written idea into one custom downloadable 3D voxel asset for $1.99. Get the GLB model and source image with no subscription.',
  keywords: ['3D voxel generator','custom voxel','GLB generator','3D asset generator','VoxelPop','voxel assets'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: {
    icon: '/voxelpop/voxelpop-logo.png',
    apple: '/voxelpop/voxelpop-logo.png',
  },
  openGraph: {
    title: 'VoxelPop | Your Idea, Made 3D for $1.99',
    description: 'Describe what you want and create one custom 3D voxel asset with a downloadable GLB model and source image for $1.99.',
    type: 'website',
    url: SITE_URL,
    siteName: 'VoxelPop',
    images: [{ url: '/voxelpop/voxelpop-logo.png', alt: 'VoxelPop — Your Idea, Made 3D' }],
  },
  twitter: {
    card: 'summary',
    title: 'VoxelPop | Your Idea, Made 3D for $1.99',
    description: 'One idea in. One custom 3D voxel asset out. GLB + source image, no subscription.',
    images: ['/voxelpop/voxelpop-logo.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletIdentityProvider>{children}</WalletIdentityProvider>
        <VoxelPopHelpWidget />
        <VoxelPopExitIntent />
      </body>
    </html>
  );
}
