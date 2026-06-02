import {
  Hero,
  Hook,
  ProvaAdicional,
  Bio,
  Jornada,
  Metodo,
  ProvaSocial,
  Bonus,
  Urgencia,
  Oferta,
  Garantia,
  FooterLipo,
} from '../efeito-lipo/_sections'

export const metadata = {
  title: 'Efeito Lipo 21 — Laüra Rosa',
  description:
    'Em apenas 21 dias, perca até 8KG secando a barriga e afinando os braços em casa — sem academia e sem canetinhas caras.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'Efeito Lipo 21 — Laüra Rosa',
    description:
      'Em apenas 21 dias, perca até 8KG secando a barriga e afinando os braços em casa.',
  },
}

export default function Page() {
  return (
    <main>
      <Hero />
      <Hook />
      <ProvaAdicional />
      <Bio />
      <Jornada />
      <Metodo />
      <ProvaSocial />
      <Bonus />
      <Urgencia />
      <Oferta />
      <Garantia />
      <FooterLipo />
    </main>
  )
}
