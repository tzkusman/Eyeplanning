import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'EYE Planning Software - Denim Crafts',
  description: 'Date-wise garment manufacturing planning ledger and delivery challan (DC) tracking system for Denim Crafts with real-time balance calculations, Supabase integration, and multi-user access control.',
  openGraph: {
    title: 'EYE Planning Software - Denim Crafts',
    description: 'Date-wise garment manufacturing planning ledger and delivery challan (DC) tracking system for Denim Crafts with real-time balance calculations, Supabase integration, and multi-user access control.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EYE Planning Software - Denim Crafts',
    description: 'Date-wise garment manufacturing planning ledger and delivery challan (DC) tracking system for Denim Crafts with real-time balance calculations, Supabase integration, and multi-user access control.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
