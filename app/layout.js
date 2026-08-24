import { WalletIdentityProvider } from './components/WalletIdentity';
import './vault-fallback.css';
import './futuristic-vault.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://voxel-vault.vercel.app').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Voxel Creator Pack | 36 Editable Assets for $15',
    template: '%s | Voxel Vault',
  },
  description: 'Download 36 editable voxel-style SVG assets for games, thumbnails, social posts and creator projects. Commercial use included. One-time $15 purchase.',
  keywords: ['voxel assets','voxel asset pack','game assets','SVG assets','creator assets','commercial use assets'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: '36 Editable Voxel Assets — $15',
    description: 'Weapons, loot, magic, tools, scenery and buildings in one editable commercial-use asset pack.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
  },
  twitter: {
    card: 'summary_large_image',
    title: '36 Editable Voxel Assets — $15',
    description: 'One download. 36 editable SVG assets. Commercial use included.',
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
