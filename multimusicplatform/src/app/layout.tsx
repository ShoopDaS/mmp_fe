import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueueProvider } from '@/contexts/QueueContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MultiMusic Platform',
  description: 'Your unified music streaming platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <QueueProvider>{children}</QueueProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
