import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'LEXSER - Plataforma Jurídica Corporativa',
    template: '%s | LEXSER',
  },
  description:
    'Plataforma corporativa para estudios jurídicos en Chile. Gestión de casos, documentos, timeline procesal y portal cliente.',
  keywords: ['abogados', 'jurídico', 'casos', 'chile', 'legal', 'corporativo'],
  authors: [{ name: 'LEXSER' }],
  creator: 'LEXSER',
  publisher: 'LEXSER',
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
    siteName: 'LEXSER',
    title: 'LEXSER - Plataforma Jurídica Corporativa',
    description: 'Plataforma corporativa para estudios jurídicos en Chile',
    images: [
      {
        url: '/logo.svg',
        width: 200,
        height: 60,
        alt: 'LEXSER Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LEXSER - Plataforma Jurídica Corporativa',
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
      <body className={`${inter.className} h-full antialiased`}>
        <div className="min-h-full">
          {/* ❌ SupabaseListener eliminado para evitar bucles de redirección */}
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  )
}
