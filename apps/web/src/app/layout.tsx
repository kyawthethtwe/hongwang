import type { Metadata } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Hongwang · Rooms in Bangkok', template: '%s · Hongwang' },
  description: 'Book rooms near BTS and MRT stations in Bangkok, by the night or by the month.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
