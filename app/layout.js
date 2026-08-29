import { WalletIdentityProvider } from './components/WalletIdentity';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

const TITLE = 'Galactic Trust | Digital Banking';
const DESCRIPTION = 'Galactic Trust is a modern digital banking interface for balances, cards, transfers, activity, and account controls. Financial actions remain simulated until regulated provider rails are connected.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Galactic Trust' },
  description: DESCRIPTION,
  keywords: ['Galactic Trust', 'digital banking', 'banking dashboard', 'digital cards', 'money management'],
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: 'Galactic Trust',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07103d',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#07103d' }}>
        <WalletIdentityProvider>{children}</WalletIdentityProvider>
      </body>
    </html>
  );
}
