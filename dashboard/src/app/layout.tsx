import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Qatar AI Phone — Business Dashboard',
  description: 'Manage hours, AI toggle, view calls, download logs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-100 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
