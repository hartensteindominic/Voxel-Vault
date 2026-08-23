import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'WorkflowForge AI', description: 'AI marketing operations for small businesses.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }