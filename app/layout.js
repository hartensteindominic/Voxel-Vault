import { WalletIdentityProvider } from './components/WalletIdentity';
import './vault-fallback.css';
import './futuristic-vault.css';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Voxel Vault | Real Property, Made Spatial',
    template: '%s | Voxel Vault',
  },
  description: 'Voxel Vault is a real-property digital-twin pilot linking ordinary property entities, permissioned blockchain ownership records and auditable net-income distribution workflows.',
  keywords: ['real estate digital twin', 'property tokenization', 'permissioned blockchain', '3D property', 'Voxel Vault'],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: {
    icon: '/voxelpop/voxelpop-logo.png',
    apple: '/voxelpop/voxelpop-logo.png',
  },
  openGraph: {
    title: 'Voxel Vault | Real Property, Made Spatial',
    description: 'A 3D real-property pilot combining property entities, permissioned blockchain ownership records and auditable distribution workflows.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Voxel Vault',
    images: [{ url: '/voxelpop/voxelpop-logo.png', alt: 'Voxel Vault' }],
  },
  twitter: {
    card: 'summary',
    title: 'Voxel Vault | Real Property, Made Spatial',
    description: 'Explore the Voxel Vault real-property digital-twin pilot.',
    images: ['/voxelpop/voxelpop-logo.png'],
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
