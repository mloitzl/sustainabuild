import type { Metadata } from 'next';
import './globals.css';
import { RelayProvider } from '@/lib/relay/relay-provider';

export const metadata: Metadata = {
  title: 'SustainaBuild',
  description: 'GreenOps CI/CD Infrastructure Manager',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 font-sans antialiased">
        <RelayProvider>{children}</RelayProvider>
      </body>
    </html>
  );
}
