import type { Metadata } from 'next';
import './globals.css';
import './banking-controls.css';
import './extras.css';
import './privacy.css';
import './privacy-link.css';

export const metadata: Metadata = {
  title: 'Work with ORXYZ',
  description:
    'Send ORXYZ your BOM, drawing, or problem SKU. Get a clear, manufacturer-direct commercial offer without the distributor markup maze.',
  metadataBase: new URL('https://orxyz.xyz'),
  openGraph: {
    title: 'Work with ORXYZ',
    description:
      'Send ORXYZ your BOM, drawing, or problem SKU. Get a clear, manufacturer-direct commercial offer without the distributor markup maze.',
    url: 'https://orxyz.xyz',
    siteName: 'ORXYZ',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
