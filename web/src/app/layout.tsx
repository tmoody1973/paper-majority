import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Paper Majority — A Congressional Strategy Game',
  description: 'Build the bill. Hold the coalition. Face the vote.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
