import type { Metadata } from 'next';
import { DM_Sans, Geist_Mono } from 'next/font/google';
import { SessionGuard } from '@/components/session-guard';
import { ThemeInit } from '@/components/theme-init';
import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TruckFlow',
  description: 'Employee and HR management for TruckFlow',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-bg text-ink flex min-h-full flex-col font-sans">
        <ThemeInit />
        <SessionGuard />
        {children}
      </body>
    </html>
  );
}
