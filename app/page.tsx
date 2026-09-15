import type { Metadata, Viewport } from 'next';
import WorkWithOrxyz from './orxyz/WorkWithOrxyz';

export const metadata: Metadata = {
  title: 'Work with ORXYZ',
  description:
    'Send ORXYZ your BOM, drawing, or problem SKU. Get a clear, manufacturer-direct commercial offer without the distributor markup maze.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
};

export default function Home() {
  return <WorkWithOrxyz />;
}
