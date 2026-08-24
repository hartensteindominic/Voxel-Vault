import { WalletIdentityProvider } from './components/WalletIdentity';
import './vault-fallback.css';
import './futuristic-vault.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://voxel-vault.vercel.app').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Custom AI Voxel Asset Pack | 25 Assets for $15',
    template: '%s | Voxel Vault',
  },
  description: 'Turn your words or reference image into a coordinated 25-piece voxel-style PNG asset pack. One-time $15 purchase with commercial-use license.',
  keywords: ['AI asset generator','voxel assets','custom game assets','voxel asset pack','PNG game assets','creator assets'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Your Idea → 25 Custom Voxel Assets — $15',
    description: 'Describe a world or add a reference image. Get a coordinated 25-piece voxel-style PNG pack in one ZIP.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
  },
  twitter: {
    card: 'summary_large_image',
    title: '25 Custom AI Voxel Assets — $15',
    description: 'One idea in. 25 matching voxel-style PNG assets out.',
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
