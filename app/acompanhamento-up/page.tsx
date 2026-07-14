import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import Script from 'next/script'
import { Pageview, Reveal, CountdownPill, CheckoutCta, VturbPlayer } from './_ui'

export const metadata: Metadata = {
  title: 'Comece acompanhada — Comunidade Corpo Feliz · Laüra Rosa',
  description:
    'Você acabou de entrar no Efeito Lipo. Faça os seus 21 dias com a Laüra do seu lado, mais 60 dias de bônus e o app completo — condição especial só nesta página.',
  robots: { index: false, follow: false },
}

// ── Canal da visita: página pós-compra × WhatsApp ───────────────────────────
// A Greenn redireciona pra cá depois da compra com ?token=…&s_id=<id da venda>.
// O TOKEN é o que autoriza a cobrança em 1 clique — sem ele, o one-click não
// cobra (a Greenn não reconhece a cliente). Por isso ele também é o sinal mais
// honesto de canal:
//   • com token  → veio do redirect pós-compra              → canal 'pagina'
//   • sem token  → veio de um link (WhatsApp, salvo, print) → canal 'wa'/'link'
//
// MENSAGEM DO ROTEIRO: os links que a Laüra já manda no WhatsApp marcam a
// mensagem no utm_content (d1-oferta-abre, d1-oferta-12h, d2-oferta-ultimas…).
// Respeitamos essa convenção — os links que já estão na mão das clientes passam
// a rastrear sem precisar trocar nada. ?m= é o apelido curto pra links novos.
//
// Cuidado: nas visitas vindas do redirect, o utm_content carrega o xcod do
// ANÚNCIO (só números e underscore, ex.: 1783860754497_178386098359312) — isso
// não é mensagem. Daí o teste de ter letra.
const GREENN_CHECKOUT = 'https://payfast.greenn.com.br/148339/offer/O8j7nc'
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined
const ehCodigoDeMensagem = (v?: string) => Boolean(v && /[a-zA-Z]/.test(v))
type SP = Record<string, string | string[] | undefined>

// ── Greenn One-Click — "Modal de Compra" ────────────────────────────────────
// Código fornecido pela Greenn (painel do upsell). Faz duas coisas: define a
// função global startLoading() (só o spinner de feedback no botão) e injeta o
// motor da cobrança em 1 clique (payfast.greenn.com.br/assets/upsell.js), que
// varre a página pelos botões [data-greenn-upsell] e processa a compra usando a
// sessão da cliente vinda do redirect pós-compra da Greenn. As crases internas
// (do SVG do spinner) estão escapadas (\`) por estar dentro de um template.
const GREENN_UPSELL_MODAL = `
window.startLoading = function(button) {
  const originalHTML = button.innerHTML;
  button.setAttribute('data-loading', 'true');
  button.innerHTML = \`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
      <path fill="#ffffff" d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/>
      <path fill="#ffffff" d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z">
        <animateTransform attributeName="transform" dur="0.75s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/>
      </path>
    </svg>\`;
  setTimeout(() => {
    button.setAttribute('data-loading', 'false');
    button.innerHTML = originalHTML;
  }, 3000);
};
(function (w, d, s, t) {
  if (w._greennUp) return;
  w._greennUp = t;
  var f = d.getElementsByTagName(s)[0], j = d.createElement(s);
  j.async = true;
  j.src = "https://payfast.greenn.com.br/assets/upsell.js?v=" + t;
  f.parentNode.insertBefore(j, f);
})(window, document, "script", Date.now());
`

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

// Letra miúda embaixo de cada botão. É o ÚNICO lugar da página que fala da
// renovação — o corpo do texto não menciona assinatura. Curta, discreta, mas
// explícita: a cliente precisa saber que será cobrada de novo, senão a cobrança
// surpresa vira reembolso/chargeback (e chargeback em volume suspende o gateway).
function Renovacao({ extra }: { extra?: string }) {
  return (
    <p style={{ fontSize: 12.5, lineHeight: 1.55, color: MUTE, margin: '14px auto 0', maxWidth: 420 }}>
      🔒 Renova por R$97 a cada 3 meses · cancele quando quiser{extra ? ` · ${extra}` : ''} · garantia de 21 dias
    </p>
  )
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

// Retrato da Laura — moldura arredondada, hairline e sombra suave. Traz o
// toque pessoal ("eu vou ser a sua personal") sem quebrar o clima clean.
function LauraPhoto({
  src, alt, w, h, maxW = 360, priority = false,
}: { src: string; alt: string; w: number; h: number; maxW?: number; priority?: boolean }) {
  return (
    <figure style={{ margin: 'clamp(28px,5.5vw,38px) auto 0', maxWidth: maxW, width: '100%' }}>
      <div style={{
        borderRadius: 22, overflow: 'hidden', lineHeight: 0,
        border: `1px solid ${CARD_LINE}`, boxShadow: '0 28px 66px rgba(0,0,0,.55)',
      }}>
        <Image
          src={src} alt={alt} width={w} height={h} priority={priority}
          sizes="(max-width: 560px) 88vw, 360px"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
    </figure>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const token = first(sp.token)                 // só o redirect pós-compra da Greenn traz
  const oneClick = Boolean(token)
  const codigo = first(sp.m) ?? first(sp.utm_content) ?? first(sp.xcod)
  const msg = !oneClick && ehCodigoDeMensagem(codigo) ? codigo!.slice(0, 40) : undefined
  const canal = first(sp.c) || (oneClick ? 'pagina' : msg ? 'wa' : 'link')
  const checkoutUrl = `${GREENN_CHECKOUT}?${new URLSearchParams({
    up_canal: canal, ...(msg ? { up_msg: msg } : {}),
  })}`

  return (
    <>
      <Pageview canal={canal} msg={msg} saleId={first(sp.s_id)} />
      {/* Sem JS, o reveal ficaria invisível — garante conteúdo visível. */}
      <noscript><style>{`.reveal{opacity:1 !important;transform:none !important}`}</style></noscript>

      {/* Greenn One-Click — Modal de Compra (define startLoading + injeta
          upsell.js). afterInteractive: carrega assim que a página fica
          interativa; os botões [data-greenn-upsell] já estão no HTML.
          Só faz sentido com token: sem ele o script não cobra — e ainda
          sequestraria o clique pra uma aba nova sem rastreio. */}
      {oneClick && (
        <Script id="greenn-upsell-modal" strategy="afterInteractive">
          {GREENN_UPSELL_MODAL}
        </Script>
      )}

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
              Antes de você começar seus 21 dias, assista este vídeo até o fim.
              É ele que decide se dessa vez o seu resultado vem rápido e fica ou
              vira só mais uma tentativa de emagrecer.
            </p>
            <VturbPlayer />
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
                É por isso que quem leva a sério tem um personal. Os treinos a seguir
                são a menor parte. O que vale é ter alguém ali todo dia criando o compromisso:
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
          <LauraPhoto
            src="/images/Foto-Laura-Barriga-hero.png"
            alt="Laura Rosa treinando em casa"
            w={1080} h={1320}
          />
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
          <Beat tone="g">Eu acelero o seu resultado agora e fico com você pra garantir que você não recupere tudo depois.</Beat>
        </Section>

        {/* ━━ SEÇÃO 5 — A OFERTA (value stack) ━━ */}
        <Section bg={BASE} py={72}>
          <Kick color={G_TEXT} />
          <h2 style={H2}>Tudo o que você recebe hoje ao entrar comigo:</h2>
          <div style={{ maxWidth: 600, margin: 'clamp(26px,5vw,34px) auto 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CheckRow lead="Acompanhamento direto comigo durante todo o desafio" tail="eu com você pra acelerar o resultado" />
            <CheckRow lead="+ 2 meses de acompanhamento de bônus, de graça" tail="quando o desafio acaba, eu fico mais 60 dias pra proteger o que você conquistou" />
            <CheckRow lead="Suporte diário" tail="te ajudo no dia a dia pra você não desistir e chegar no resultado que eu te prometi" />
            <CheckRow lead="Bônus especial: acesso completo ao app da Comunidade Corpo Feliz" tail="todos os meus produtos lá dentro (mais de R$1.000 em conteúdo)" />
            <CheckRow lead="Grupo da Comunidade" tail="você não caminha sozinha, está entre mulheres fazendo o mesmo que você" />
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
                '4 níveis do iniciante ao avançado, com o próximo passo sempre claro',
                'Treinos novos todo mês, ajustados pra fase do ciclo',
                'Treinos de 3 e 5 minutos pros dias impossíveis',
                'Plano alimentar calculado para o seu objetivo atual, sem restrições e com flexibilidade nos alimentos',
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
            {/* O preço grande é o MENSAL — é ele que carrega a oferta ("menos de
                um lanche por mês"). O corpo da página não fala de assinatura (a
                pedido do Vinicius); a renovação vive na letra miúda abaixo de
                CADA botão (RENOVACAO), curta mas explícita. Ela NÃO pode sumir:
                a oferta O8j7nc cobra R$97 a cada 90 dias enquanto a cliente não
                cancelar, e cobrança que a cliente não esperava volta como
                reembolso e chargeback — que é o que derruba conta em gateway. */}
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(2.6rem,11vw,3.4rem)', lineHeight: 1, color: O_TEXT,
              margin: '6px 0 0', letterSpacing: '-0.02em',
            }}>
              menos de R$33 por mês
            </p>
            <p style={{ ...BODY, fontSize: 'clamp(16px,4.2vw,18px)', margin: '14px auto 0', maxWidth: 440, color: INK, fontWeight: 700 }}>
              R$97 — acompanhamento personalizado com a Laüra.
            </p>
            <p style={{ fontSize: 'clamp(14px,3.6vw,15px)', lineHeight: 1.55, color: MUTE, margin: '16px auto 0', maxWidth: 420 }}>
              Assim que garantir essa condição, você já recebe imediatamente todo
              acesso ao conteúdo do aplicativo, grupo e já iniciamos nossa jornada juntinhas.
            </p>
            <div style={{ marginTop: 'clamp(26px,5vw,34px)' }}>
              <CheckoutCta oneClick={oneClick} checkoutUrl={checkoutUrl} label="preco">QUERO ESSA CONDIÇÃO</CheckoutCta>
              <Renovacao extra="Acesso imediato" />
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
              Você pode testar os 21 dias que mais importam, sem risco.
            </h2>
            <div style={{ maxWidth: 560, margin: '24px auto 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ ...BODY, textAlign: 'center' }}>
                A garantia é de 21 dias, o desafio inteiro. Você experimenta ter
                alguém do seu lado exatamente nos dias que sempre te fizeram parar antes.
              </p>
              <p style={{ ...BODY, textAlign: 'center' }}>
                Se ao fim dos 21 dias você sentir que fazer acompanhada não mudou nada
                pra você, é só conversar comigo e eu devolvo cada centavo. O risco é todo meu.
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
                Eu só consigo deixar por R$97 — menos de R$33 por mês — com tudo isso
                disponível, porque você acabou de entrar para o Efeito Lipo.
                É meu presente e retribuição à sua confiança em meu trabalho.
              </p>
              <p style={{ ...BODY, textAlign: 'center', color: INK, fontWeight: 600 }}>
                Mas é válido somente agora e aqui nesta página.
              </p>
            </div>
            <div style={{ marginTop: 'clamp(28px,5.5vw,36px)' }}>
              <CheckoutCta oneClick={oneClick} checkoutUrl={checkoutUrl} label="urgencia">Sim, quero a profe Laüra comigo</CheckoutCta>
              <Renovacao />
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
          <LauraPhoto
            src="/images/Laura-Arrumada-hero.jpg"
            alt="Laura Rosa"
            w={1984} h={2976} maxW={320}
          />
          <div style={{ maxWidth: 560, margin: 'clamp(28px,5.5vw,36px) auto 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              Vem comigo. Te espero na jornada juntinhas.
            </p>
          </div>
          <div style={{ marginTop: 'clamp(28px,6vw,40px)' }}>
            <CheckoutCta oneClick={oneClick} checkoutUrl={checkoutUrl} label="fechamento">QUERO COMEÇAR ACOMPANHADA AGORA</CheckoutCta>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: MUTE, textAlign: 'center', margin: '16px auto 0', maxWidth: 400 }}>
              🔒 Renova por R$97 a cada 3 meses · cancele quando quiser · acesso na hora · 21 dias de garantia
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
