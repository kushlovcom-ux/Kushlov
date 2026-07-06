import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { clientEnv } from '@/lib/env';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.siteUrl),
  title: {
    default: 'Kushlov — Meet, Match, Go Live',
    template: '%s · Kushlov',
  },
  description:
    'Kushlov is a premium dating & live-streaming platform. Match, chat, audio & video call, watch live streams, send gifts and more.',
  icons: { icon: '/kush.png', apple: '/kush.png' },
  openGraph: {
    title: 'Kushlov',
    description: 'Meet, Match, Go Live.',
    images: ['/kush.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
