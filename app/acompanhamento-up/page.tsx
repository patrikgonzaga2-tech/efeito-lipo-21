import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import { Pageview, Reveal, CountdownPill, CheckoutCta } from './_ui'

export const metadata: Metadata = {
  title: 'Comece acompanhada — Comunidade Corpo Feliz · Laüra Rosa',
  description:
    'Você acabou de entrar no Efeito Lipo. Faça os seus 21 dias com a Laüra do seu lado, mais 60 dias de bônus e o app completo — condição especial só nesta página.',
  robots: { index: false, follow: false },
}

/* ══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — upsell escuro premium
   Paleta e fontes herdadas dos tokens da marca (globals.css). Ritmo de fundos:
   BASE (escuro) → RAISED (escuro mais claro) → bloco de ação. Um acento por
   função: LARANJA = urgência/atenção, VERDE = afirmação/CTA/checkmarks.
   ══════════════════════════════════════════════════════════════════════════ */

// Superfícies (escuro quente, casa com o off-white --pale da marca)
const BASE = '#100E0C'   // fundo escuro base — hero e seções ímpares
const RAISED = '#17140F' // escuro levemente mais claro — alternância
const LINE = 'rgba(255,255,255,.08)'      // hairline entre seções
const CARD = 'rgba(255,255,255,.035)'     // superfície de card
const CARD_LINE = 'rgba(255,255,255,.09)' // borda de card

// Texto sobre escuro
const INK = '#F4F1EC'    // títulos / ênfase (alto contraste)
const SUB = '#C7C2B9'    // corpo
const MUTE = '#948E84'   // microcopy / apoio

// Acentos
const O = 'var(--o)'        // #F57100 — urgência / atenção
const O_TEXT = '#FF9D45'    // laranja clareado p/ texto sobre escuro (contraste)
const O_SOFT = 'rgba(245,113,0,.12)'
const O_BORDER = 'rgba(245,113,0,.34)'
const G_TEXT = '#43D982'    // verde clareado p/ texto/checks sobre escuro
const G_SOFT = 'rgba(28,135,60,.14)'
const G_BORDER = 'rgba(43,217,111,.34)'

// ── Tipografia base ─────────────────────────────────────────────────────────
const H2: CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800,
  fontSize: 'clamp(1.6rem,5.2vw,2.4rem)', lineHeight: 1.18,
  letterSpacing: '-0.02em', color: INK, textAlign: 'center',
  maxWidth: 640, margin: '0 auto',
}
const BODY: CSSProperties = {
  fontSize: 'clamp(16px,4.1vw,18px)', lineHeight: 1.65, color: SUB,
}

// ── Primitivos ──────────────────────────────────────────────────────────────

// Seção com fundo, respiro vertical fluido, hairline no topo e reveal on-scroll.
function Section({
  bg, py, children, style, reveal = true,
}: { bg: string; py: number; children: ReactNode; style?: CSSProperties; reveal?: boolean }) {
  const inner = <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>{children}</div>
  return (
    <section
      style={{
        background: bg, borderTop: `1px solid ${LINE}`,
        padding: `clamp(48px,8.5vw,${py}px) 20px`, ...style,
      }}
    >
      {reveal ? <Reveal>{inner}</Reveal> : inner}
    </section>
  )
}

// Container de leitura à esquerda (texto longo lê melhor alinhado à esquerda).
function Read({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
}

// Acento não-verbal no topo da seção — ponto + hairline. Detalhe silencioso.
function Kick({ color = O }: { color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      <span style={{ width: 28, height: 1, background: `linear-gradient(90deg,${color},transparent)` }} />
    </div>
  )
}

// Frase-virada isolada. tone 'o' = tensão (laranja) · 'g' = resolução (verde).
function Beat({ children, tone = 'o' }: { children: ReactNode; tone?: 'o' | 'g' }) {
  return (
    <p style={{
      fontFamily: 'var(--font-display)', fontWeight: 800,
      fontSize: 'clamp(18px,4.8vw,21px)', lineHeight: 1.34,
      color: tone === 'g' ? G_TEXT : O_TEXT, textAlign: 'center',
      maxWidth: 560, margin: 'clamp(24px,5vw,32px) auto',
    }}>{children}</p>
  )
}

// Chip — palavra-conceito isolada, pill de acento.
function Chip({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: 'clamp(14px,3.6vw,16px)', color: O_TEXT,
      background: O_SOFT, border: `1px solid ${O_BORDER}`,
      borderRadius: 999, padding: '9px 18px', letterSpacing: '.01em',
    }}>{children}</span>
  )
}

// Check em círculo — verde. SVG p/ nitidez (evita emoji no value stack).
function Check() {
  return (
    <span aria-hidden style={{
      flexShrink: 0, width: 26, height: 26, borderRadius: 999,
      display: 'grid', placeItems: 'center', marginTop: 1,
      background: G_SOFT, border: `1px solid ${G_BORDER}`,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G_TEXT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  )
}

// Linha do value stack — check + lead bold + cauda em 1 respiro.
function CheckRow({ lead, tail }: { lead: string; tail: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <Check />
      <p style={{ ...BODY, margin: 0, lineHeight: 1.5 }}>
        <span style={{ color: INK, fontWeight: 700 }}>{lead}</span>
        <span style={{ color: MUTE }}> — {tail}</span>
      </p>
    </div>
  )
}

// Card de pilar — grid 2x2 desktop / 1 col mobile. Título bold + 1 linha.
function PillarCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${CARD_LINE}`, borderRadius: 16,
      padding: 'clamp(18px,3.4vw,22px)',
    }}>
      <h4 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 'clamp(15px,3.8vw,17px)', color: INK, margin: 0, lineHeight: 1.3,
      }}>{title}</h4>
      <p style={{ fontSize: 'clamp(14px,3.6vw,15px)', lineHeight: 1.5, color: MUTE, margin: '7px 0 0' }}>{desc}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default function Page() {
  return (
    <>
      <Pageview />
      {/* Sem JS, o reveal ficaria invisível — garante conteúdo visível. */}
      <noscript><style>{`.reveal{opacity:1 !important;transform:none !important}`}</style></noscript>

      <main style={{ background: BASE, color: INK, overflowX: 'hidden' }}>

        {/* ━━ SEÇÃO 1 — HERO ━━ */}
        <section style={{ position: 'relative', background: BASE, overflow: 'hidden', padding: 'clamp(48px,10vw,80px) 20px' }}>
          {/* Glow decorativo, sutil, atrás do título */}
          <div aria-hidden style={{
            position: 'absolute', top: '-18%', left: '50%', transform: 'translateX(-50%)',
            width: 620, maxWidth: '120%', height: 420,
            background: 'radial-gradient(60% 60% at 50% 40%, rgba(245,113,0,.16), transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24,
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5,
              letterSpacing: '.16em', textTransform: 'uppercase', color: O_TEXT,
              background: O_SOFT, border: `1px solid ${O_BORDER}`, borderRadius: 999, padding: '7px 16px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: O }} />
              Comunicado importante
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(2rem,7vw,3.2rem)', lineHeight: 1.15,
              letterSpacing: '-0.025em', color: INK, margin: 0,
            }}>
              Bem-vinda ao Efeito Lipo! Seu acesso está{' '}
              <span style={{ color: O_TEXT }}>quase concluído…</span>
            </h1>
            <p style={{
              fontFamily: 'var(--font-body)', fontWeight: 500,
              fontSize: 'clamp(16px,4.4vw,18px)', lineHeight: 1.55,
              color: SUB, margin: '16px auto 0', maxWidth: 560,
            }}>
              Antes de você começar seus 21 dias, leia este comunicado até o fim.
              É ele que decide se dessa vez o seu resultado vem rápido e fica — ou
              vira só mais uma tentativa de emagrecer.
            </p>
            <p style={{ fontSize: 'clamp(15px,3.9vw,16px)', lineHeight: 1.55, color: MUTE, margin: '24px auto 0', maxWidth: 520 }}>
              Seu acesso já está sendo liberado. O que vem agora é uma decisão que
              só dá pra tomar aqui, neste momento.
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'clamp(18px,4.8vw,20px)', lineHeight: 1.4,
              color: INK, margin: '24px auto 0', maxWidth: 580,
            }}>
              Porque tem uma diferença entre a mulher que seca e volta pro ponto de
              partida e a que <span style={{ color: O_TEXT }}>seca e permanece</span>.
              E não tem nada a ver com força de vontade.
            </p>
          </div>
        </section>

        {/* ━━ SEÇÃO 2 — A VIRADA DE CRENÇA ━━ */}
        <Section bg={RAISED} py={72}>
          <Kick />
          <h2 style={H2}>
            Quantas vezes você já começou uma dieta ou um treino animada… e largou
            no meio do caminho?
          </h2>
          <div style={{ marginTop: 'clamp(24px,5vw,32px)' }}>
            <Read>
              <p style={BODY}>
                Se você parou pra contar agora, foram mais vezes do que gostaria de
                admitir. E em quase todas você terminou achando que o problema era
                você, que faltou disciplina.
              </p>
              <p style={BODY}>
                Mas na maioria das vezes não foi o método que te fez parar. Foi a
                vida real atropelando:
              </p>
            </Read>
          </div>
          {/* Strip de 3 mini-cards — 2+1 centralizado no mobile, 3 colunas no
              desktop (regras em globals.css: .mini-strip). */}
          <div className="mini-strip" style={{ marginTop: 'clamp(20px,4vw,28px)' }}>
            {[
              { icon: '🗓️', text: 'A semana de trabalho que engoliu o seu dia' },
              { icon: '🤒', text: 'O filho que adoeceu e virou a rotina de cabeça pra baixo' },
              { icon: '🥱', text: 'O cansaço de quem cuida de todo mundo e não sobra energia pra si' },
            ].map((c) => (
              <div key={c.icon} style={{
                background: CARD, border: `1px solid ${CARD_LINE}`, borderRadius: 16,
                padding: 'clamp(16px,3.4vw,20px)', textAlign: 'center',
              }}>
                <div aria-hidden style={{ fontSize: 26, marginBottom: 10 }}>{c.icon}</div>
                <p style={{ fontSize: 'clamp(14px,3.6vw,15px)', lineHeight: 1.45, color: SUB, margin: 0 }}>{c.text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'clamp(24px,5vw,32px)' }}>
            <Read>
              <p style={BODY}>
                A verdade é mais simples que “falta de disciplina”: sozinha, sempre
                vão existir dias em que o ânimo some. E no dia difícil, sem ninguém
                do lado, todo mundo para.
              </p>
            </Read>
          </div>
          <Beat tone="o">
            Então o que decide o seu resultado não é o quanto você se esforça. É
            outra coisa — e é ela que separa quem desiste de quem chega lá.
          </Beat>
        </Section>

        {/* ━━ SEÇÃO 3 — O MECANISMO ━━ */}
        <Section bg={BASE} py={72}>
          <Kick />
          <h2 style={H2}>
            O que será que aquelas mulheres que têm o corpo de dar inveja têm, que
            você ainda não teve?
          </h2>
          <div style={{ marginTop: 'clamp(24px,5vw,32px)' }}>
            <Read>
              <p style={BODY}>
                Você provavelmente pensou em motivação. Ela ajuda, mas vai embora no
                dia ruim igual pra todo mundo. O que separa de verdade é uma coisa
                que quase ninguém te conta: o ambiente em que você está.
              </p>
              <p style={BODY}>
                Treinar e comer bem fica muito mais fácil quando você está cercada de
                gente fazendo o mesmo, não é? Aí desistir deixa de ser só quebrar uma
                promessa que você fez sozinha no espelho, e passa a ser sair do time.
              </p>
              <p style={BODY}>
                É por isso que quem leva a sério tem um personal. A técnica é a menor
                parte. O que vale é ter alguém ali todo dia criando o compromisso:
                cobrando com cuidado, te dizendo o próximo passo e não deixando você
                sumir quando bate a preguiça.
              </p>
            </Read>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', margin: 'clamp(24px,5vw,32px) auto 0' }}>
            <Chip>Ambiente</Chip>
            <Chip>Motivação</Chip>
            <Chip>Compromisso</Chip>
          </div>
          <p style={{ ...BODY, textAlign: 'center', color: INK, maxWidth: 560, margin: '18px auto 0' }}>
            Foi isso que faltou em todas as outras vezes. E é exatamente isso que eu
            vim te dar agora.
          </p>
        </Section>

        {/* ━━ SEÇÃO 4 — EU VOU SER A SUA PERSONAL ━━ */}
        <Section bg={RAISED} py={72}>
          <Kick color={G_TEXT} />
          <h2 style={H2}>Nos próximos dias, eu vou ser a sua personal.</h2>
          <p style={{ ...BODY, textAlign: 'center', maxWidth: 560, margin: 'clamp(22px,4.5vw,28px) auto 0' }}>
            Durante todo o seu desafio, eu vou estar com você de verdade:
          </p>
          <div style={{ maxWidth: 560, margin: '22px auto 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'Te dizendo o que fazer a cada dia',
              'Respondendo na hora quando bater a dúvida de “será que tô fazendo certo?”',
              'Te puxando pra frente justo nos dias em que, sozinha, você largaria',
            ].map((t) => (
              <div key={t} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Check />
                <p style={{ ...BODY, margin: 0, lineHeight: 1.5 }}>{t}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'clamp(24px,5vw,32px)' }}>
            <Read>
              <p style={{ ...BODY, color: INK, fontWeight: 600, textAlign: 'center' }}>
                Esse é o compromisso que garante o seu resultado.
              </p>
              <p style={BODY}>
                E talvez você já esteja pensando: “tá, Laura, mas e quando os 21 dias
                acabarem?”
              </p>
              <p style={BODY}>
                Essa é a parte que eu mais quero te contar. Quando o desafio terminar,
                eu vou continuar te acompanhando.
              </p>
            </Read>
          </div>
          {/* Badge de bônus */}
          <div style={{
            maxWidth: 560, margin: 'clamp(24px,5vw,32px) auto 0', textAlign: 'center',
            background: G_SOFT, border: `1px solid ${G_BORDER}`, borderRadius: 18,
            padding: 'clamp(20px,4.5vw,26px)',
          }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(18px,4.8vw,22px)', lineHeight: 1.32, color: G_TEXT, margin: 0,
            }}>
              Eu continuo com você por mais 2 meses inteiros. De graça.
            </p>
          </div>
          <div style={{ marginTop: 'clamp(20px,4vw,24px)' }}>
            <Read>
              <p style={{ ...BODY, textAlign: 'center' }}>
                São 60 dias a mais pra sustentar o que você conquistou, pra você não
                passar de novo pela única coisa que mais dói: fazer todo o esforço e
                ver tudo voltar alguns meses depois.
              </p>
            </Read>
          </div>
          <Beat tone="g">Eu acelero o seu resultado agora e fico pra proteger ele depois.</Beat>
        </Section>

        {/* ━━ SEÇÃO 5 — A OFERTA (value stack) ━━ */}
        <Section bg={BASE} py={72}>
          <Kick color={G_TEXT} />
          <h2 style={H2}>Tudo o que você recebe hoje ao entrar comigo:</h2>
          <div style={{ maxWidth: 600, margin: 'clamp(26px,5vw,34px) auto 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CheckRow lead="Acompanhamento direto comigo durante todo o desafio" tail="eu com você pra acelerar o resultado" />
            <CheckRow lead="+ 2 meses de acompanhamento de bônus, de graça" tail="quando o desafio acaba, eu fico mais 60 dias pra proteger o que você conquistou" />
            <CheckRow lead="Meu WhatsApp direto" tail="te ajudo no dia a dia pra você não desistir e chegar no resultado que eu te prometi" />
            <CheckRow lead="Bônus especial: acesso completo ao app da Comunidade Corpo Feliz" tail="todos os meus produtos lá dentro (mais de R$1.000 em conteúdo)" />
            <CheckRow lead="Grupo da Comunidade no WhatsApp" tail="você não caminha sozinha, está entre mulheres fazendo o mesmo que você" />
          </div>

          {/* Sub-bloco — os 4 pilares do método */}
          <div style={{
            maxWidth: 620, margin: 'clamp(28px,5.5vw,38px) auto 0',
            background: RAISED, border: `1px solid ${CARD_LINE}`, borderRadius: 20,
            padding: 'clamp(22px,4.5vw,30px)',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(17px,4.4vw,20px)', lineHeight: 1.3, color: INK,
              textAlign: 'center', margin: '0 auto', maxWidth: 460,
            }}>
              Dentro do app, o Método dos Treinos Hormonais:
            </h3>
            <div style={{
              display: 'grid', gap: 12, marginTop: 'clamp(20px,4vw,26px)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}>
              <PillarCard title="Respeita o seu ciclo" desc="o treino se ajusta ao seu momento do mês, mais intenso ou mais leve." />
              <PillarCard title="Feito pra metabolismo travado" desc="SOP, menopausa ou anos de dieta: ensina o corpo a queimar de novo." />
              <PillarCard title="Equilibra o estresse" desc="você sai da aula melhor, não destruída. Menos estresse, menos gordura na barriga." />
              <PillarCard title="Alimentação sem cortar tudo" desc="planos por fase do mês, pra sua rotina real. Nutrir, não punir." />
            </div>

            {/* Mini-lista do que ela acessa */}
            <div style={{ marginTop: 'clamp(20px,4vw,26px)', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {[
                'Avaliação de entrada que monta a sua trilha, não a padrão',
                '4 níveis do iniciante ao avançado, com o próximo passo sempre claro',
                'Treinos novos todo mês, ajustados pra fase do ciclo',
                'Treinos de 3 e 5 minutos pros dias impossíveis',
                'Planos alimentares por fase do mês, sem restrição extrema',
              ].map((t) => (
                <div key={t} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span aria-hidden style={{ color: O_TEXT, fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>✦</span>
                  <p style={{ fontSize: 'clamp(14px,3.6vw,15px)', lineHeight: 1.5, color: SUB, margin: 0 }}>{t}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ━━ SEÇÃO 6 — PREÇO, ÂNCORA E TIMER ━━ */}
        <Section bg={RAISED} py={72}>
          <div style={{
            maxWidth: 560, margin: '0 auto', textAlign: 'center',
            background: 'linear-gradient(180deg, rgba(245,113,0,.08), rgba(245,113,0,.02))',
            border: `1px solid ${O_BORDER}`, borderRadius: 24,
            padding: 'clamp(30px,6vw,52px) clamp(20px,5vw,40px)',
          }}>
            <CountdownPill bg="rgba(245,113,0,.14)" color={O_TEXT} border={O_BORDER} />
            <h2 style={{ ...H2, fontSize: 'clamp(1.4rem,4.8vw,2rem)', margin: '24px auto 0', maxWidth: 460 }}>
              E olha a condição pra você entrar agora:
            </h2>
            <p style={{ fontSize: 'clamp(20px,5vw,24px)', color: MUTE, textDecoration: 'line-through', margin: '20px 0 0', fontWeight: 500 }}>
              De R$497
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(2.6rem,11vw,3.4rem)', lineHeight: 1, color: O_TEXT,
              margin: '6px 0 0', letterSpacing: '-0.02em',
            }}>
              por R$147
            </p>
            <p style={{ ...BODY, fontSize: 'clamp(15px,3.9vw,16px)', margin: '20px auto 0', maxWidth: 440 }}>
              Pagamento único. Sem mensalidade, sem recorrência. Você paga uma vez e
              leva o acompanhamento inteiro, os 2 meses de bônus e o app completo.
            </p>
            <p style={{ fontSize: 'clamp(14px,3.6vw,15px)', lineHeight: 1.55, color: MUTE, margin: '16px auto 0', maxWidth: 420 }}>
              Assim que confirmar, seu acesso ao grupo e ao app cai na hora, e eu já
              começo com você.
            </p>
            <div style={{ marginTop: 'clamp(26px,5vw,34px)' }}>
              <CheckoutCta label="preco">QUERO ESSA CONDIÇÃO</CheckoutCta>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: MUTE, margin: '14px auto 0', maxWidth: 400 }}>
                🔒 Pagamento único de R$147 · Acesso imediato · Garantia de 21 dias
              </p>
            </div>
          </div>
        </Section>

        {/* ━━ SEÇÃO 7 — GARANTIA ━━ */}
        <Section bg={BASE} py={64}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 22,
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
              letterSpacing: '.1em', textTransform: 'uppercase', color: G_TEXT,
              background: G_SOFT, border: `1px solid ${G_BORDER}`, borderRadius: 999, padding: '8px 18px',
            }}>
              <span aria-hidden>🛡️</span> Garantia de 21 dias
            </div>
            <h2 style={{ ...H2, maxWidth: 560 }}>
              Você pode testar justo os dias que mais importam, sem risco.
            </h2>
            <div style={{ maxWidth: 560, margin: '24px auto 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ ...BODY, textAlign: 'center' }}>
                A garantia é de 21 dias, o desafio inteiro. Você experimenta ter
                alguém do seu lado exatamente nos dias que sempre te fizeram parar antes.
              </p>
              <p style={{ ...BODY, textAlign: 'center' }}>
                Se ao fim dos 21 dias você sentir que fazer acompanhada não mudou nada
                pra você, é só me falar e eu devolvo cada centavo. O risco é todo meu.
              </p>
            </div>
          </div>
        </Section>

        {/* ━━ SEÇÃO 8 — URGÊNCIA + CTA ━━ */}
        <Section bg={RAISED} py={64}>
          <div style={{
            maxWidth: 600, margin: '0 auto', textAlign: 'center',
            background: G_SOFT, border: `1px solid ${G_BORDER}`, borderRadius: 24,
            padding: 'clamp(30px,6vw,52px) clamp(20px,5vw,40px)',
          }}>
            <h2 style={{ ...H2, maxWidth: 520 }}>Essa condição é só agora, e é só aqui.</h2>
            <div style={{ maxWidth: 520, margin: '22px auto 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ ...BODY, textAlign: 'center' }}>
                Eu só consigo abrir os R$147 com tudo isso pra quem acabou de entrar
                no Efeito Lipo, neste momento, nesta página.
              </p>
              <p style={{ ...BODY, textAlign: 'center', color: INK, fontWeight: 600 }}>
                Se você sair daqui, essa condição não volta.
              </p>
            </div>
            <div style={{ marginTop: 'clamp(28px,5.5vw,36px)' }}>
              <CheckoutCta label="urgencia">SIM, QUERO COMEÇAR ACOMPANHADA</CheckoutCta>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: MUTE, margin: '16px auto 0', maxWidth: 400 }}>
                🔒 Pagamento único de R$147 · Acesso imediato · Garantia de 21 dias
              </p>
            </div>
          </div>
        </Section>

        {/* ━━ SEÇÃO 9 — OBJEÇÕES DISSOLVIDAS ━━ */}
        <Section bg={BASE} py={64}>
          <Kick />
          <h2 style={{ ...H2, marginBottom: 'clamp(26px,5vw,34px)' }}>Ainda com um pé atrás?</h2>
          <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { q: '“Eu não tenho tempo.”', a: 'Por isso existem os treinos de 3 e 5 minutos. Nos dias impossíveis, 3 minutos que você faz valem mais que 1 hora que você não consegue.' },
              { q: '“Eu já tentei de tudo e nada funcionou.”', a: 'Você tentou sozinha e com treino que ignora o seu corpo de mulher. Aqui o treino trabalha a favor do seu ciclo, e eu estou do lado pra você não parar.' },
              { q: '“Eu vejo isso depois.”', a: 'Depois essa condição não existe mais, e você começa o desafio sozinha. Fazer comigo do primeiro dia é o que muda o resultado.' },
            ].map((o) => (
              <div key={o.q} style={{
                background: CARD, border: `1px solid ${CARD_LINE}`, borderRadius: 16,
                padding: 'clamp(20px,4vw,26px)',
              }}>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: 'clamp(16px,4.2vw,18px)', color: INK, margin: 0, lineHeight: 1.35,
                }}>{o.q}</h3>
                <p style={{ ...BODY, fontSize: 'clamp(15px,3.9vw,16px)', margin: '10px 0 0', lineHeight: 1.55 }}>{o.a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ━━ SEÇÃO 10 — FECHAMENTO EMOCIONAL ━━ */}
        <Section bg={BASE} py={64}>
          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={BODY}>Vou ser sincera com você.</p>
            <p style={BODY}>
              Você pode fazer esses 21 dias sozinha, torcendo pra não desistir no
              meio. Ou pode fazer comigo do seu lado, chegando mais rápido agora e
              com a tranquilidade de saber que dessa vez o resultado veio pra ficar.
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'clamp(19px,5vw,22px)', lineHeight: 1.45, color: INK, margin: '4px 0 0',
            }}>
              Eu sei o que eu escolheria pra mim. E acho que você também sabe.
              <br />
              Vem comigo. Eu te espero do outro lado.
            </p>
          </div>
          <div style={{ marginTop: 'clamp(28px,6vw,40px)' }}>
            <CheckoutCta label="fechamento">QUERO COMEÇAR ACOMPANHADA AGORA</CheckoutCta>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: MUTE, textAlign: 'center', margin: '16px auto 0', maxWidth: 400 }}>
              🔒 R$147 à vista · Acesso na hora · 21 dias de garantia
            </p>
          </div>
        </Section>

        {/* ━━ SEÇÃO 11 — RODAPÉ ━━ */}
        <footer style={{ background: BASE, borderTop: `1px solid ${LINE}`, textAlign: 'center', padding: '28px 20px 44px', fontSize: 12, color: MUTE }}>
          © 2026 Corpo Feliz · Laüra Rosa
        </footer>
      </main>
    </>
  )
}
