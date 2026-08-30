const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io').replace(/\/$/, '');

const TITLE = 'Galactic Trust | Financial App';
const DESCRIPTION = 'Galactic Trust is a financial technology interface for balances, cards, transfers, activity, and account controls. Galactic Trust is not a bank; real deposits and money movement remain production-gated until an approved sponsor-bank program is live.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Galactic Trust' },
  description: DESCRIPTION,
  keywords: ['Galactic Trust', 'financial app', 'banking dashboard', 'digital cards', 'money management'],
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', url: SITE_URL, siteName: 'Galactic Trust' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#07103d' };

export default function RootLayout({ children }) {
  return <html lang="en"><body style={{ margin: 0, background: '#07103d' }}>{children}</body></html>;
}
