import type { Metadata } from 'next';
import './globals.css';
import './banking-controls.css';
import './extras.css';
import './privacy.css';
import './privacy-link.css';

export const metadata: Metadata = {
  title: 'Galactic Trust',
  description: 'Galactic Trust digital banking dashboard.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
