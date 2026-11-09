import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import { SessionGuard } from '@/components/session-guard';
import { ThemeInit } from '@/components/theme-init';
import { ToastProvider } from '@/components/toast';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TruckFlow',
  description: 'Workforce, attendance, and camera operations',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="text-ink flex min-h-full flex-col font-sans">
        <ThemeInit />
        <SessionGuard />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
