import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Xel Chile - Plataforma Jurídica Corporativa',
    template: '%s | Xel Chile',
  },
  description:
    'Plataforma corporativa para estudios jurídicos en Chile. Gestión de casos, documentos, timeline procesal y portal cliente.',
  keywords: ['abogados', 'jurídico', 'casos', 'chile', 'legal', 'corporativo'],
  authors: [{ name: 'Xel Chile' }],
  creator: 'Xel Chile',
  publisher: 'Xel Chile',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    siteName: 'Xel Chile',
    title: 'Xel Chile - Plataforma Jurídica Corporativa',
    description: 'Plataforma corporativa para estudios jurídicos en Chile',
    images: [
      {
        url: '/logo.svg',
        width: 200,
        height: 60,
        alt: 'Xel Chile Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Xel Chile - Plataforma Jurídica Corporativa',
    description: 'Plataforma corporativa para estudios jurídicos en Chile',
    images: ['/logo.svg'],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {},
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es-CL" className="h-full">
      <body
        className={`${inter.className} h-full min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <div className="relative min-h-screen">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(96,165,250,0.2),_transparent_50%)]" />
          <div className="relative min-h-screen">
            <div className="absolute inset-x-0 top-0 mx-auto h-32 w-full max-w-5xl rounded-full bg-white/40 blur-3xl opacity-70" />
            <main className="relative z-10 min-h-screen pb-10 pt-6">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
