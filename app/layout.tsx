import type { Metadata } from 'next';
import './globals.css';
import './banking-controls.css';
import './extras.css';
import './privacy.css';
import './privacy-link.css';

export const metadata: Metadata = {
  title: 'ORXYZ | Technology, connected.',
  description:
    'ORXYZ helps businesses evaluate practical technology solutions and connect with suitable providers across robotics, automation, phone charging, smart unattended retail, and AI business tools.',
  metadataBase: new URL('https://orxyz.xyz'),
  openGraph: {
    title: 'ORXYZ | Technology, connected.',
    description:
      'Independent technology sourcing, provider qualification, introductions, and deployment coordination for businesses.',
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
