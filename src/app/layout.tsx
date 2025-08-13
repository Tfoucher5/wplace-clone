import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WPlace Clone - Collaborative Pixel Art on World Map',
  description: 'Place pixels on an interactive world map and create collaborative pixel art with players from around the globe.',
  keywords: 'pixel art, collaborative, map, r/place, wplace, online game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <body className={`${inter.className} h-full bg-slate-900 text-white overflow-hidden`}>
        <div className="h-full flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}