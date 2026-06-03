import QuizApp from './_quiz'

export const metadata = {
  title: 'Avaliação gratuita — Efeito Lipo 21',
  description:
    'Faça a avaliação gratuita e descubra como ativar o Efeito Lipo e queimar até 8kg em 21 dias — sem academia e sem canetinhas caras.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'Avaliação gratuita — Efeito Lipo 21',
    description: 'Descubra o que está travando o seu corpo em menos de 3 minutos.',
  },
}

export default function Page() {
  return <QuizApp />
}
