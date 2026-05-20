import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '700', '800'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Efeito Lipo 21 — Laüra Rosa',
  description:
    'Em apenas 21 dias, perca até 8KG secando a barriga e afinando os braços em casa — sem academia e sem canetinhas caras.',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'Efeito Lipo 21 — Laüra Rosa',
    description:
      'Em apenas 21 dias, perca até 8KG secando a barriga e afinando os braços em casa.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${bricolage.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased"
        style={{ fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}
        suppressHydrationWarning
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}
