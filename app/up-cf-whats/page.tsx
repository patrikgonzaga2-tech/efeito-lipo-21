import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import { UpsellPageview, WaCta } from './_cta'

export const metadata: Metadata = {
  title: 'Comunidade Corpo Feliz — sua condição especial · Laüra Rosa',
  description:
    'Você acabou de entrar no Efeito Lipo. Comece os seus 21 dias com a Laüra do seu lado e proteja o seu resultado depois — condição especial por 24 horas.',
  robots: { index: false, follow: false },
}

// ── Paleta clara (leve, leitura confortável) ────────────────────────────
const WHITE = '#ffffff'
const SOFT = '#F1F7F2'      // verde bem suave — alternância de seções
const INK = 'var(--ink)'    // #1A1A1A — títulos e ênfases (alto contraste)
const SUB = 'var(--sub)'    // #555 — corpo de texto
const MUTE = 'var(--mute)'  // #888 — microcopy / apoio
const GREEN = 'var(--g)'    // #1C873C — cor de ação (destaques de texto)
const ORANGE = 'var(--o)'   // #F57100 — urgência

// ── Tipografia base ─────────────────────────────────────────────────────
const H2: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(1.6rem,5.4vw,2.4rem)',
  lineHeight: 1.18,
  letterSpacing: '-0.02em',
  color: INK,
  textAlign: 'center',
  maxWidth: 640,
  margin: '0 auto',
}
const BODY: CSSProperties = {
  fontSize: 'clamp(16px,4.2vw,18px)',
  lineHeight: 1.62,
  color: SUB,
}

// ── Blocos reutilizáveis ────────────────────────────────────────────────
function Section({ bg, py, children, style }: { bg: string; py: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ background: bg, paddingTop: `clamp(40px,${py / 16}rem,${py}px)`, paddingBottom: `clamp(40px,${py / 16}rem,${py}px)`, paddingLeft: 20, paddingRight: 20, ...style }}>
      <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>{children}</div>
    </section>
  )
}

// Container de leitura à esquerda (textos longos leem melhor alinhados à esq.)
function Read({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 600, margin: '0 auto' }}>{children}</div>
}

// Frase isolada de virada — centralizada, com peso e respiro.
function Beat({ children }: { children: ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-display)', fontWeight: 800,
      fontSize: 'clamp(18px,4.8vw,20px)', lineHeight: 1.32,
      color: GREEN, textAlign: 'center',
      maxWidth: 560, margin: '24px auto',
    }}>{children}</p>
  )
}

// ════════════════════════════════════════════════════════════════════════
export default function Page() {
  return (
    <>
      <UpsellPageview />

      {/* ━━ SEÇÃO 1 — BARRA DE ALERTA ━━ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40, textAlign: 'center',
        padding: '9px 16px', color: WHITE, fontSize: 'clamp(13px,3.4vw,14px)',
        fontWeight: 700, letterSpacing: '.01em',
        background: 'linear-gradient(90deg,#1C873C,#25A24B)',
        boxShadow: '0 4px 18px rgba(28,135,60,.28)',
      }}>
        ⚡ Comunicado oficial: leia com muita atenção para garantir o seu resultado
      </div>

      <main style={{ background: WHITE, color: INK, overflowX: 'hidden' }}>

        {/* ━━ SEÇÃO 2 — HERO / GANCHO ━━ (fundo branco, separado da barra verde) */}
        <section style={{ background: WHITE, padding: 'clamp(48px,9vw,84px) 20px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(2rem,7vw,3.2rem)', lineHeight: 1.15,
              letterSpacing: '-0.025em', color: INK, margin: 0,
            }}>
              Parabéns! Agora, antes de você começar, preciso te contar o que as
              mulheres que <span style={{ color: GREEN }}>mais emagrecem</span> fazem de diferente.
            </h1>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontWeight: 500,
              fontSize: 'clamp(16px,4.4vw,19px)', lineHeight: 1.4,
              color: MUTE, margin: '16px auto 0', maxWidth: 540,
            }}>
              E não, não é treinar mais nem comer menos.
            </h3>

          </div>
        </section>

        {/* ━━ SEÇÃO 2B — A PROMESSA ━━ (separada do hero, fundo verde suave) */}
        <Section bg={SOFT} py={56}>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={BODY}>
              Daqui a 21 dias você vai se olhar no espelho e mal vai se reconhecer.
              A barriga mais seca. Os braços mais finos. As roupas folgando.
            </p>
            <p style={BODY}>
              Mas eu quero muito mais do que isso pra você. Eu quero que você chegue
              lá mais rápido — e, principalmente, que dessa vez o resultado venha pra ficar.
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(18px,4.6vw,20px)',
              lineHeight: 1.4, color: INK, margin: '4px auto 0', maxWidth: 560,
            }}>
              E existe <strong style={{ color: GREEN }}>uma única diferença</strong> entre as mulheres
              que conseguem isso e as que largam no meio do caminho.
            </p>
          </div>
        </Section>

        {/* ━━ SEÇÃO 3 — O DIFERENCIAL (NÃO FAZER SOZINHA) ━━ */}
        <Section bg={WHITE} py={64}>
          <h2 style={H2}>As que vão mais longe não fazem sozinhas.</h2>
          <Read>
            <p style={{ ...BODY, marginTop: 28 }}>
              Pensa em todas as vezes que você começou animada e largou no meio do
              caminho. Quase nunca foi porque o método era ruim. Foi porque, em algum
              dia difícil, você estava sozinha — e não teve ninguém pra garantir que
              você não desistisse.
            </p>
            <p style={{
              ...BODY, marginTop: 20, fontStyle: 'italic', color: '#444',
              borderLeft: `3px solid rgba(28,135,60,.4)`, paddingLeft: 16,
            }}>
              Foi a semana corrida em que não sobrou um minuto pra você. Foi aquele dia
              em que bateu o desânimo e ninguém estava ali pra dizer “continua”. Foi o
              fim de semana em que você saiu da linha e veio aquela culpa que faz a
              gente desistir de tudo.
            </p>
          </Read>
          <Beat>É justamente aí que eu entro.</Beat>
          <Read>
            <p style={BODY}>
              Eu quero estar do seu lado te dizendo “não desiste, você está quase lá”
              justo no dia em que você mais precisa ouvir isso. E quando bater aquela
              dúvida de “será que estou fazendo certo?”, você tem resposta na hora, sem
              perder dias parada sem saber.
            </p>
            <p style={{ ...BODY, marginTop: 20, color: INK, fontWeight: 600 }}>
              É isso que faz você não desistir. E é por isso que quem entra na Corpo
              Feliz seca mais rápido — e vai até o fim.
            </p>
          </Read>
        </Section>

        {/* ━━ SEÇÃO 4 — REFORÇO LÓGICO ━━ */}
        <Section bg={SOFT} py={56}>
          <h2 style={H2}>Pensa comigo por um segundo.</h2>
          <div style={{ maxWidth: 560, margin: '24px auto 0', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
            <p style={{ ...BODY, fontSize: 'clamp(17px,4.4vw,19px)', color: INK }}>
              É a mesma coisa que treinar na academia sozinha ou ter um personal do seu lado.
            </p>
            <p style={{ ...BODY, fontSize: 'clamp(17px,4.4vw,19px)', color: INK }}>
              Ou fazer dieta por conta própria ou ter uma nutricionista te orientando.
            </p>
          </div>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(18px,4.8vw,20px)',
            color: INK, textAlign: 'center', maxWidth: 560, margin: '28px auto 0',
          }}>
            Em qual dos dois você acha que a mulher chega mais longe?
          </p>
          <p style={{ ...BODY, color: MUTE, textAlign: 'center', maxWidth: 560, margin: '16px auto 0' }}>
            Pois é. Você já sabe a resposta.
          </p>
          <p style={{ ...BODY, textAlign: 'center', maxWidth: 560, margin: '16px auto 0' }}>
            E é exatamente essa a minha proposta pra você. Te acompanhar desde o seu
            primeiro dia do Efeito Lipo.
          </p>
        </Section>

        {/* ━━ SEÇÃO 5 — O DEPOIS (PROTEÇÃO DO RESULTADO) ━━ */}
        <Section bg={WHITE} py={64}>
          <h2 style={H2}>E quando os 21 dias terminam, eu não te solto.</h2>
          <Read>
            <p style={{ ...BODY, marginTop: 28 }}>
              Porque você já passou por isso antes, não passou?
            </p>
            <p style={{ ...BODY, marginTop: 20 }}>
              A gente emagrece, fica feliz… e alguns meses depois, sem nem perceber,
              está tudo de volta. A roupa aperta de novo. A frustração chega. E vem
              aquele pensamento que machuca: <em style={{ color: INK, fontStyle: 'italic', fontWeight: 700 }}>“de novo, não.”</em>
            </p>
          </Read>
          <Beat>É exatamente isso que eu não deixo acontecer.</Beat>
          <Read>
            <p style={BODY}>
              Quando o Efeito Lipo destravar o seu corpo, eu estarei do seu lado pra
              sustentar esse resultado para que você nunca mais volte para trás. E não
              só sustentar — eu quero você melhor, mês após mês. Sem dieta restritiva,
              sem passar fome, sem academia. Com treinos de 15, 20 minutos em casa, do
              jeito que respeita o corpo da mulher.
            </p>
          </Read>
          <div style={{
            maxWidth: 560, margin: '28px auto 0', textAlign: 'center',
            background: '#E8F4EB', border: '1px solid rgba(28,135,60,.28)',
            borderRadius: 18, padding: 'clamp(18px,4vw,24px)',
          }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(17px,4.6vw,20px)', lineHeight: 1.4, color: 'var(--gd)', margin: 0,
            }}>
              Resumindo: eu acelero o seu resultado agora e protejo ele depois.
            </p>
          </div>
        </Section>

        {/* ━━ SEÇÃO 6 — CENA DA VIDA REAL ━━ */}
        <Section bg={SOFT} py={56}>
          <h2 style={H2}>Imagine como vai ser a sua vida daqui a alguns meses.</h2>
          <Read>
            <p style={{ ...BODY, marginTop: 28 }}>
              Teve um dia em que tudo deu errado e não sobrou tempo pra nada? Você faz
              3 minutos e pronto — mantém a constância, sem aquela culpa de ter falhado.
            </p>
            <p style={{ ...BODY, marginTop: 20 }}>
              E então uma amiga te olha de cima a baixo e pergunta:{' '}
              <em style={{ fontStyle: 'italic', color: INK }}>“o que você está fazendo de diferente?”</em>{' '}
              E dessa vez você não responde <em style={{ fontStyle: 'italic', color: INK }}>“ah, comecei mais uma dieta”</em>.
              Dessa vez você responde, com um sorriso de canto de boca:{' '}
              <em style={{ fontStyle: 'italic', color: GREEN, fontWeight: 700 }}>“aprendi a emagrecer da forma certa.”</em>
            </p>
          </Read>
        </Section>

        {/* ━━ SEÇÃO 7 — URGÊNCIA ━━ */}
        <Section bg={WHITE} py={56} style={{ paddingTop: 8 }}>
          <div style={{
            background: '#FFF7E8', border: '1px solid rgba(245,113,0,.32)',
            borderRadius: 22, padding: 'clamp(28px,6vw,48px) clamp(20px,5vw,40px)',
          }}>
            <h2 style={{ ...H2, color: ORANGE, maxWidth: 560 }}>
              Agora preste atenção, porque isto é para você e só agora.
            </h2>
            <div style={{ maxWidth: 560, margin: '24px auto 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <p style={BODY}>
                Como você acabou de entrar para o Efeito Lipo, eu separei uma condição
                especial para você entrar também na Comunidade Corpo Feliz — e já começar
                os seus 21 dias comigo do seu lado, do jeito certo.
              </p>
              <p style={BODY}>
                Mas essa condição vale apenas pelas <strong style={{ color: INK }}>próximas 24 horas</strong>.
                Depois disso ela desaparece — e não tem como eu segurar.
              </p>
              <p style={BODY}>
                E acredite: não vale a pena deixar para depois. Deixar para depois é abrir
                mão de fazer esses 21 dias comigo te acompanhando — e correr o risco de não
                aproveitar nem metade do resultado que você poderia ter agora.
              </p>
            </div>
          </div>
        </Section>

        {/* ━━ SEÇÃO 9 — CTA PRINCIPAL ━━ */}
        <section style={{ background: WHITE, padding: 'clamp(36px,8vw,48px) 20px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
            <WaCta label="topo">SIM, EU QUERO COMEÇAR ACOMPANHADA →</WaCta>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: MUTE, margin: '14px auto 0', maxWidth: 360 }}>
              💬 Esse é o meu contato do WhatsApp pra te explicar individualmente como eu vou te ajudar.
            </p>
          </div>
        </section>

        {/* ━━ SEÇÃO 10 — FECHAMENTO EMOCIONAL ━━ */}
        <Section bg={SOFT} py={56}>
          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={BODY}>Vou ser sincera com você.</p>
            <p style={BODY}>
              Você pode fazer esses 21 dias sozinha, torcendo para não desistir no meio
              do caminho… ou pode fazer comigo do seu lado — chegando mais rápido no
              resultado agora, com a tranquilidade de saber que dessa vez ele veio para ficar.
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'clamp(18px,4.6vw,20px)', lineHeight: 1.45, color: INK, margin: 0,
            }}>
              Eu sei o que eu escolheria. E acho que você também sabe.
              <br />
              Venha falar comigo. Eu te espero lá dentro.
            </p>
          </div>

          <div style={{ marginTop: 32 }}>
            <WaCta label="final">QUERO GARANTIR MINHA VAGA AGORA →</WaCta>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: MUTE, textAlign: 'center', margin: '14px auto 0' }}>
            ⏳ Essa condição especial vai embora em 24 horas
          </p>
        </Section>

        {/* ━━ SEÇÃO 11 — RODAPÉ ━━ */}
        <footer style={{ background: SOFT, textAlign: 'center', padding: '24px 20px 40px', fontSize: 12, color: MUTE, borderTop: '1px solid rgba(0,0,0,.06)' }}>
          © 2026 Corpo Feliz · Laüra Rosa
        </footer>
      </main>
    </>
  )
}
