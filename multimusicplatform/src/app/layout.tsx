import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueueProvider } from '@/contexts/QueueContext';
import { HubProvider } from '@/contexts/HubContext';
import AppLayout from '@/components/layout/AppLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Unison',
  description: 'Your music, unified.',
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
          <QueueProvider>
            <HubProvider>
              <AppLayout>
                {children}
              </AppLayout>
            </HubProvider>
          </QueueProvider>
        </AuthProvider>
      </body>
    </html>
  );
}