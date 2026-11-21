import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'IDLIX Stream — Nonton Film & Serial TV HD',
  description: 'Streaming film dan serial TV kualitas HD langsung di browser.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
        <Script
          src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
