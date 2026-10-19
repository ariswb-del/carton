import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GameProvider } from '@/components/Game';

export const metadata: Metadata = {
  title: 'Carton Plein',
  description: 'Ouvre des cartons de disques, collectionne vinyles, CD, K7 et 8-track, échange avec tes amis.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Stencil+Display:wght@700;900&family=Big+Shoulders+Display:wght@700;900&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&family=Permanent+Marker&display=swap" />
        <link rel="preconnect" href="https://i.discogs.com" />
      </head>
      <body><GameProvider>{children}</GameProvider></body>
    </html>
  );
}
