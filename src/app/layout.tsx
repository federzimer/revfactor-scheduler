import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RevFactor - Book a Call',
  description: 'Schedule a sales call with the RevFactor team',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
