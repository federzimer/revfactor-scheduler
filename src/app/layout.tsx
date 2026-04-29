import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'RevFactor - Book a Call',
  description: 'Schedule a sales call with the RevFactor team',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1CTGBJ9RLK"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1CTGBJ9RLK');
            gtag('config', 'AW-18106897053');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
