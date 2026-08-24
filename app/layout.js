import { WalletIdentityProvider } from './components/WalletIdentity';
import './vault-fallback.css';
import './futuristic-vault.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://voxel-vault.vercel.app').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VoxelPop 3D Generator | 3 Custom GLB Voxels for $11.97',
    template: '%s | Voxel Vault',
  },
  description: 'Turn your words or reference image into three coordinated voxel-style 3D GLB assets with source images, ZIP download, and a commercial-use license.',
  keywords: ['AI 3D asset generator','voxel assets','custom GLB assets','VoxelPop','3D voxel generator','creator assets'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'VoxelPop: 3 Custom 3D Voxel Assets for $11.97',
    description: 'Describe a subject or add a reference image. Generate three matching source images, build movable GLB meshes, and download the complete pack.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VoxelPop 3D Generator - 3 GLB Voxels for $11.97',
    description: 'One idea in. Three matching 3D voxel assets out.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletIdentityProvider>{children}</WalletIdentityProvider>
      </body>
    </html>
  );
}
