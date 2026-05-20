'use client'

import { useState } from 'react'
import Image from 'next/image'
import Script from 'next/script'
import { useReveal } from '@/hooks/use-reveal'

const CHECKOUT_HREF = 'https://pay.hotmart.com/M100707979H?off=wp53y95s'

const IMG = {
  hero:        { src: '/images/hero-laura.jpg',                                                                       w: 1080, h: 1080 },
  antesDepois: { src: '/images/Antes%20e%20Depois%20Laura.jpeg',                                                      w: 1080, h: 1080 },
  camila:      { src: '/images/Depoimento%20Camila%2030%20anos%2C%20m%C3%A3e%20de%202%20e%20confeitera.jpeg',         w: 1288, h: 1600 },
  suhene:      { src: '/images/Depoimento%20Suhene%2043%20anos%20m%C3%A3e.jpeg',                                      w: 1080, h: 1080 },
  isabela:     { src: '/images/Depoimento%20Isabela%20-%20M%C3%A3e.jpg',                                              w: 1170, h: 1012 },
  evelyn:      { src: '/images/Depoimento%202%20Evelyn%20M%C3%A3e.jpg',                                               w: 1080, h: 1080 },
  priscila:    { src: '/images/Depoimento%20Priscila%20Resultado%20em%207%20dias.jpg',                                w: 1290, h: 1274 },
  gabriela34:  { src: '/images/Depoimento%20Gabriela%2034%20anos%20m%C3%A3e%20e%20trabalha%20fora%20de%20casa.jpeg',  w: 1200, h: 1600 },
  gilmara:     { src: '/images/Depoimento%20Gilmara%20m%C3%A3e%20de%203%20e%20v%C3%B3%20com%20neto%20de%205%20anos.jpg', w: 1290, h: 1292 },
  gabriela27:  { src: '/images/Depoimento%20Gabriela%2027%20anos%20com%20filho%20autista.jpeg',                       w: 1200, h: 1600 },
  suelen:      { src: '/images/Depoimento%20Suelen%2035%20anos%20m%C3%A3e%20e%20enfermeira%20noturna.jpg',            w: 844,  h: 1600 },
  thais:       { src: '/images/Depoimento%20Thais%2034%20anos.jpg',                                                   w: 1281, h: 1619 },
  celia:       { src: '/images/Depoimento%20C%C3%A9lia%2030%20anos.jpg',                                              w: 1290, h: 1348 },
  pamela:      { src: '/images/Depoimento%20Pamela%20M%C3%A3e.jpg',                                                   w: 1080, h: 1080 },
}

// Botão pill padrão (cor de ação)
function CtaPill({
  children,
  size = 'md',
  variant = 'orange',
  ariaLabel,
}: {
  children: React.ReactNode
  size?: 'md' | 'lg'
  variant?: 'orange' | 'green'
  ariaLabel?: string
}) {
  const padding =
    size === 'lg'
      ? 'clamp(18px,2.2vw,24px) clamp(32px,3.5vw,56px)'
      : 'clamp(16px,2vw,22px) clamp(28px,3vw,52px)'
  const bg = variant === 'green' ? 'var(--gd)' : 'var(--o)'
  const fg = variant === 'green' ? '#fff' : '#000'
  const shadow =
    variant === 'green'
      ? '0 8px 32px rgba(0,72,17,0.3)'
      : '0 8px 40px rgba(245,113,0,0.35)'

  return (
    <a
      href={CHECKOUT_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel || 'Garantir minha vaga no Efeito Lipo 21'}
      className="font-display inline-flex items-center gap-3 font-bold rounded-full transition-all duration-300 hover:-translate-y-1"
      style={{
        fontSize: size === 'lg' ? 'clamp(16px,1.8vw,20px)' : 'clamp(15px,1.5vw,18px)',
        padding,
        background: bg,
        color: fg,
        boxShadow: shadow,
      }}
    >
      {children}
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: variant === 'green' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
      >
        ›
      </span>
    </a>
  )
}

// ────────────────────────────────────────────────────────────────────
// LazyVSL — carrega o player vturb só no clique (poupa ~7 MB no LCP)
// ────────────────────────────────────────────────────────────────────
function LazyVSL() {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        aspectRatio: '16 / 9',
        background: 'linear-gradient(135deg, var(--gd) 0%, var(--ink) 100%)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
      }}
    >
      {loaded ? (
        <>
          <vturb-smartplayer
            id="ab-6a073e90f38f377fba3ca511"
            style={{ display: 'block', margin: '0 auto', width: '100%', height: '100%' }}
            aria-label="Vídeo de apresentação do Efeito Lipo 21"
            role="region"
          />
          <Script
            src="https://scripts.converteai.net/9406f62d-bd68-44a6-971a-c0a91bdff3c8/ab-test/6a073e90f38f377fba3ca511/player.js"
            strategy="afterInteractive"
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label="Reproduzir vídeo de apresentação do Efeito Lipo 21"
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center transition-all duration-300 hover:brightness-110 group"
          style={{ cursor: 'pointer', background: 'transparent' }}
        >
          {/* Botão play */}
          <div
            className="flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{
              width: 'clamp(64px, 11vw, 88px)',
              height: 'clamp(64px, 11vw, 88px)',
              borderRadius: '50%',
              background: 'var(--o)',
              boxShadow: '0 8px 32px rgba(245,113,0,0.5)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="#000"
              width="38%"
              height="38%"
              style={{ marginLeft: '8%' }}
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>

          {/* Label */}
          <div
            className="font-display mt-5"
            style={{
              color: '#fff',
              fontSize: 'clamp(13px,1.5vw,15px)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Assista agora
          </div>
        </button>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 1 — HERO (fundo escuro, sem logo, sem menu)
// ────────────────────────────────────────────────────────────────────
export function Hero() {
  useReveal()

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'var(--gd)' }}
      aria-label="Efeito Lipo 21"
    >
      {/* Blobs decorativos */}
      <svg
        className="blob-float1 absolute pointer-events-none will-change-transform"
        style={{ top: '-20%', right: '-15%', width: 'min(700px,90vw)', height: 'min(700px,90vw)' }}
        viewBox="0 0 400 400"
      >
        <path d="M60,20 C120,-20 220,10 280,60 C340,110 380,180 360,260 C340,340 260,390 180,380 C100,370 20,320 10,240 C0,160 0,60 60,20Z" fill="rgba(245,113,0,0.18)" />
      </svg>
      <svg
        className="blob-float2 absolute pointer-events-none will-change-transform"
        style={{ bottom: '-10%', left: '-10%', width: 'min(500px,70vw)', height: 'min(500px,70vw)' }}
        viewBox="0 0 300 300"
      >
        <path d="M40,10 C90,-15 170,5 210,50 C250,95 270,160 240,210 C210,260 140,280 80,260 C20,240 -10,170 5,110 C20,50 -10,35 40,10Z" fill="rgba(28,135,60,0.25)" />
      </svg>

      <div
        className="relative z-10 w-full max-w-[1080px] mx-auto px-5 sm:px-8 flex flex-col items-center text-center"
        style={{
          paddingTop: 'clamp(56px,8vw,96px)',
          paddingBottom: 'clamp(48px,6vw,80px)',
        }}
      >
        <h1
          className="font-display mb-6 max-w-[900px]"
          style={{
            fontSize: 'clamp(32px,5.4vw,68px)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            color: '#fff',
          }}
        >
          Em apenas 21 dias, perca até 8KG{' '}
          <span style={{ color: 'var(--o)' }}>secando a barriga e afinando os braços</span> —
          em casa e sem as canetinhas caras!
        </h1>

        <p
          className="reveal reveal-d1 mb-8 sm:mb-10"
          style={{
            fontSize: 'clamp(17px,2.2vw,20px)',
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.78)',
            maxWidth: 720,
            fontFamily: 'var(--font-body)',
          }}
        >
          O mesmo segredo que as blogueiras e atrizes estão usando pra secar a barriga e
          afinar os braços (e que a maioria das nutricionistas e personais nunca vão te contar).
        </p>

        {/* VSL — lazy click-to-load */}
        <div className="reveal reveal-d2 mb-8 sm:mb-10 w-full" style={{ maxWidth: 720 }}>
          <LazyVSL />
        </div>

        <div className="reveal reveal-d3">
          <CtaPill size="lg" ariaLabel="Quero ativar o Efeito Lipo">
            Quero ativar o Efeito Lipo
          </CtaPill>
        </div>

        <div
          className="reveal reveal-d4 mt-5"
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em' }}
        >
          Acesso imediato · Pagamento 100% seguro
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 2 — HOOK + ANTES/DEPOIS DA LAURA (fundo branco)
// ────────────────────────────────────────────────────────────────────
export function Hook() {
  return (
    <section
      className="py-20 sm:py-24 lg:py-28"
      style={{ background: '#fff' }}
      aria-label="O segredo do Efeito Lipo"
    >
      <div className="max-w-[760px] mx-auto px-5 sm:px-8 text-center">
        <h2
          className="reveal mb-8"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4vw,44px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}
        >
          O segredo que as blogueiras e atrizes estão usando —{' '}
          <span style={{ color: 'var(--o)' }}>e que eu vou te contar aqui</span>
        </h2>

        <div
          className="reveal reveal-d1 space-y-5 text-left sm:text-center"
          style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--sub)' }}
        >
          <p>
            Não é Ozempic. Não é Mounjaro. Não é nenhuma dessas canetinhas caras com chances
            de ter o efeito rebote e voltar tudo ao que é hoje.
          </p>
          <p>
            É o <strong style={{ color: 'var(--ink)' }}>Efeito Lipo</strong>. Que é quando o
            seu corpo para de reter gordura e começa a secar de dentro pra fora — como se você
            tivesse apertado um botão de reset no seu próprio metabolismo.
          </p>
          <p>E eu sei disso porque vivi na pele.</p>
          <p>
            Com SOP, 15 quilos a mais, treinando todo dia e piorando — até que eu descobri que
            o problema nunca foi o meu esforço. Foi a <strong>inflamação travando tudo</strong>.
            Quando eu mudei a ordem, em 23 dias 8 quilos foram embora. Olha com os seus
            próprios olhos 👇
          </p>
        </div>

        <div
          className="reveal reveal-d2 mt-10 mx-auto"
          style={{ maxWidth: 600, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
        >
          <Image
            src={IMG.hero.src}
            width={IMG.hero.w}
            height={IMG.hero.h}
            sizes="(min-width: 640px) 600px, 92vw"
            alt="Laüra Rosa — antes e depois"
            className="w-full h-auto block"
          />
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 3 — PROVA ADICIONAL (fundo creme, grid 3 colunas)
// ────────────────────────────────────────────────────────────────────
const provaCards = [
  { ...IMG.camila,  alt: 'Camila, 30 anos, mãe e confeiteira' },
  { ...IMG.suhene,  alt: 'Suhene, 43 anos, mãe' },
  { ...IMG.isabela, alt: 'Isabela, mãe' },
]

export function ProvaAdicional() {
  return (
    <section className="py-20 sm:py-24 lg:py-28" style={{ background: 'var(--pale)' }}>
      <div className="max-w-[1080px] mx-auto px-5 sm:px-8">
        <div className="text-center max-w-[680px] mx-auto mb-12 sm:mb-14">
          <h2
            className="reveal mb-5"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px,4.2vw,48px)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            A transformação não foi sorte.{' '}
            <span style={{ color: 'var(--o)' }}>Foi o Efeito Lipo.</span>
          </h2>
          <p
            className="reveal reveal-d1"
            style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--sub)' }}
          >
            Limpeza primeiro. Ativação Metabólica depois. Queima Total por último. É
            exatamente essa ordem que faz a diferença. E é exatamente ela que você vai aplicar
            quando entrar no Efeito Lipo 21.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {provaCards.map((c, i) => (
            <div
              key={i}
              className={`reveal ${i === 1 ? 'reveal-d1' : i === 2 ? 'reveal-d2' : ''} overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5`}
              style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                border: '1px solid rgba(0,0,0,0.05)',
                background: '#fff',
              }}
            >
              <Image
                src={c.src}
                width={c.w}
                height={c.h}
                sizes="(min-width: 1024px) 340px, (min-width: 640px) 48vw, 92vw"
                alt={c.alt}
                className="block w-full h-auto"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 4 — BIO DA CRIADORA (fundo branco, 2 colunas)
// ────────────────────────────────────────────────────────────────────
export function Bio() {
  return (
    <section className="py-20 sm:py-24 lg:py-28" style={{ background: '#fff' }}>
      <div className="max-w-[1080px] mx-auto px-5 sm:px-8">
        <h2
          className="reveal text-center mb-12 sm:mb-14"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.2vw,48px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}
        >
          Quem é <span style={{ color: 'var(--o)' }}>Laüra Rosa?</span>
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 lg:gap-12 items-start">
          <div
            className="reveal mx-auto lg:mx-0 w-full"
            style={{ maxWidth: 360, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
          >
            <Image
              src={IMG.antesDepois.src}
              width={IMG.antesDepois.w}
              height={IMG.antesDepois.h}
              sizes="(min-width: 1024px) 360px, 92vw"
              alt="Laüra Rosa — antes e depois"
              className="w-full h-auto block"
            />
          </div>

          <div
            className="reveal reveal-d1 space-y-5"
            style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--sub)' }}
          >
            <p>
              Sou Laüra Rosa, educadora física, especialista em emagrecimento feminino e o
              que me trouxe até aqui vai muito além de qualquer formação.
            </p>
            <p>
              Com 23 anos eu descobri que tinha SOP — Síndrome dos Ovários Policísticos.
              Engordei 15 quilos em menos de um ano sem conseguir explicar por quê. Fazia
              academia todo dia. Pesava cada grama de comida. Cortava carboidrato, cortava
              doce, cortava tudo que mandavam cortar. E quanto mais eu me esforçava, pior eu
              ficava.
            </p>
            <p>
              Foi quando eu entendi que não bastava eu dar o meu melhor. Era a{' '}
              <strong style={{ color: 'var(--ink)' }}>inflamação</strong> impedindo o meu corpo
              de queimar. Eu estava treinando e comendo de um jeito que piorava tudo, em vez
              de resolver.
            </p>
            <p>
              Quando eu mudei a ordem — desinchar antes de treinar — o meu corpo respondeu. 8
              quilos em 23 dias. A calça que não fechava há dois anos estava larga.
            </p>
            <p>
              Aí eu testei com as minhas seguidoras. Com 30 anos, com 45, com filho, sem
              filho, com rotina impossível. Mais de 5.000 mulheres depois: o resultado foi o
              mesmo.
            </p>
            <p>
              Foi por isso que eu criei o Efeito Lipo 21. Porque eu sei o que é fazer tudo
              certo e não ver resultado. E sei que quando você descobre a ordem certa, o seu
              corpo responde.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--ink)',
                lineHeight: 1.4,
              }}
            >
              Secar é consequência de desinchar. E é exatamente isso que você vai aprender no
              Efeito Lipo 21.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 5 — JORNADA DOS 21 DIAS (widget interativo)
// ────────────────────────────────────────────────────────────────────
const fases = [
  {
    label: 'Limpeza',
    dias: 'Dias 1–7',
    titulo: 'Desinchar para destravar',
    desc:
      'O primeiro passo é tirar a inflamação que segura tudo. Alimentação anti-inflamatória, drenagem express de 3 minutos em casa e o protocolo que solta o excesso de líquido. Resultado: a barriga já amanhece menos inchada e a roupa começa a folgar antes mesmo da balança se mexer.',
  },
  {
    label: 'Ativação Metabólica',
    dias: 'Dias 8–14',
    titulo: 'Acordar a queima',
    desc:
      'Com o corpo desinflamado, o metabolismo volta a responder. Treinos curtos e específicos para o corpo feminino — feitos em casa, sem academia — acordam a queima de gordura. É aqui que a balança começa a sair do lugar de verdade.',
  },
  {
    label: 'Queima Total',
    dias: 'Dias 15–21',
    titulo: 'Consolidar o resultado',
    desc:
      'O corpo entra em estado de queima sustentada. Você afina a barriga e os braços, firma a pele e fixa o novo ritmo. No fim dos 21 dias, você não voltou ao ponto de partida — você descobriu o caminho que mantém o resultado.',
  },
]

export function Jornada() {
  const [aberta, setAberta] = useState<number>(0)

  return (
    <section className="py-20 sm:py-24 lg:py-28" style={{ background: 'var(--pale)' }}>
      <div className="max-w-[760px] mx-auto px-5 sm:px-8 text-center mb-10 sm:mb-12">
        <h2
          className="reveal mb-5"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.2vw,48px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}
        >
          O segredo está <span style={{ color: 'var(--o)' }}>no método</span>
        </h2>
        <p
          className="reveal reveal-d1"
          style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--sub)', maxWidth: 600, margin: '0 auto' }}
        >
          A maioria das mulheres tenta tudo ao mesmo tempo — treina, corta comida, toma
          suplemento — e não vê resultado. O Efeito Lipo funciona em três estímulos numa ordem
          que quase ninguém conhece. Cada fase prepara o corpo para a próxima. Pule uma, e o
          resultado não vem.
        </p>
      </div>

      <div className="max-w-[720px] mx-auto px-5 sm:px-8">
        {/* Hint claro acima do acordeão */}
        <div
          className="reveal reveal-d2 flex items-center justify-center gap-2 mb-5"
          style={{
            fontSize: 13,
            color: 'var(--o)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74" />
            <path d="M11 21h6a2 2 0 0 0 2-2v-5a4 4 0 0 0-4-4H8.5l-3 3 3 3" />
          </svg>
          Toque em cada fase para ver os detalhes
        </div>

        {/* Acordeão */}
        <div className="reveal reveal-d2 flex flex-col gap-3">
          {fases.map((f, i) => {
            const open = i === aberta
            return (
              <div
                key={i}
                className="rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                  background: '#fff',
                  border: open ? '2px solid var(--o)' : '1px solid rgba(0,0,0,0.08)',
                  boxShadow: open
                    ? '0 12px 36px rgba(245,113,0,0.18)'
                    : '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`fase-${i}-body`}
                  onClick={() => setAberta(open ? -1 : i)}
                  className="w-full text-left flex items-center gap-4 p-5 sm:p-6 transition-colors duration-200 hover:bg-black/[0.02]"
                  style={{ cursor: 'pointer' }}
                >
                  {/* Badge numerado */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center font-display font-bold transition-all duration-300"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: open ? 'var(--o)' : 'rgba(0,0,0,0.06)',
                      color: open ? '#fff' : 'var(--mute)',
                      fontSize: 20,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Título + dias */}
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: open ? 'var(--o)' : 'var(--mute)',
                        marginBottom: 2,
                      }}
                    >
                      Fase {i + 1} · {f.dias}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(17px,2.2vw,20px)',
                        fontWeight: 800,
                        color: 'var(--ink)',
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {f.label}
                    </div>
                  </div>

                  {/* Chevron giratório */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center transition-transform duration-300"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: open ? 'var(--o)' : 'rgba(0,0,0,0.06)',
                      color: open ? '#fff' : 'var(--ink)',
                      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                    aria-hidden="true"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {/* Corpo expansível */}
                <div
                  id={`fase-${i}-body`}
                  className={open ? 'acc-body-enter acc-body-open' : 'acc-body-enter'}
                  aria-hidden={!open}
                >
                  <div className="px-5 sm:px-6 pb-6 pt-1 pl-[88px]">
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(18px,2.4vw,22px)',
                        fontWeight: 800,
                        lineHeight: 1.25,
                        letterSpacing: '-0.01em',
                        color: 'var(--ink)',
                        marginBottom: 10,
                      }}
                    >
                      {f.titulo}
                    </h3>
                    <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--sub)' }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 6 — MÉTODO (fundo escuro)
// ────────────────────────────────────────────────────────────────────
export function Metodo() {
  return (
    <section
      className="relative overflow-hidden py-20 sm:py-24 lg:py-28"
      style={{ background: 'var(--ink)' }}
    >
      <svg
        className="blob-float2 absolute pointer-events-none will-change-transform"
        style={{ top: '-10%', right: '-15%', width: 'min(520px,70vw)', height: 'min(520px,70vw)' }}
        viewBox="0 0 300 300"
      >
        <path d="M40,10 C90,-15 170,5 210,50 C250,95 270,160 240,210 C210,260 140,280 80,260 C20,240 -10,170 5,110 C20,50 -10,35 40,10Z" fill="rgba(245,113,0,0.10)" />
      </svg>

      <div className="relative z-10 max-w-[760px] mx-auto px-5 sm:px-8 text-center">
        <h2
          className="reveal mb-6"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.5vw,52px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: '#fff',
          }}
        >
          O método que <span style={{ color: 'var(--o)' }}>acorda o seu metabolismo</span>
        </h2>
        <p
          className="reveal reveal-d1 mb-6"
          style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.78)',
            maxWidth: 620,
            margin: '0 auto',
          }}
        >
          Não é sobre se matar no treino. É sobre fazer na ordem certa.
        </p>
        <p
          className="reveal reveal-d1 mb-10"
          style={{
            fontSize: 17,
            lineHeight: 1.75,
            color: 'rgba(255,255,255,0.65)',
            maxWidth: 620,
            margin: '0 auto',
          }}
        >
          O corpo inflamado é igual a um carro com o freio de mão puxado. Você pisa no
          acelerador, gasta energia — e não sai do lugar. Quando você aprende a soltar o freio
          primeiro, o mesmo esforço que antes não movia a balança começa a secar o corpo de
          verdade.
        </p>

        <div
          className="reveal reveal-d2 mb-10 font-display"
          style={{
            fontSize: 'clamp(16px,2vw,20px)',
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: 'var(--o)',
            textTransform: 'uppercase',
          }}
        >
          Sem academia. Sem fome. Sem suplemento caro.
        </div>

        <blockquote
          className="reveal reveal-d3 mx-auto mb-10"
          style={{
            maxWidth: 640,
            textAlign: 'left',
            padding: '1rem 1.25rem',
            background: 'rgba(255,255,255,0.04)',
            borderLeft: '3px solid var(--o)',
            borderRadius: '0 12px 12px 0',
            fontStyle: 'italic',
            fontSize: 17,
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          “O Efeito Lipo é quando o seu corpo para de estocar gordura localizada e entra em
          estado de queima — como se você tivesse apertado um botão de reset no seu próprio
          metabolismo.”
        </blockquote>

        <div
          className="reveal reveal-d3 mx-auto mb-10"
          style={{ maxWidth: 480, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.30)' }}
        >
          <Image
            src={IMG.evelyn.src}
            width={IMG.evelyn.w}
            height={IMG.evelyn.h}
            sizes="(min-width: 640px) 480px, 92vw"
            alt="Depoimento Evelyn — Mãe"
            className="w-full h-auto block"
          />
        </div>

        <div className="reveal reveal-d4">
          <CtaPill size="lg" ariaLabel="Quero perder até 8kg">
            Quero perder até 8KG!
          </CtaPill>
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 7 — PROVA SOCIAL DE VOLUME (fundo branco, grid 2 colunas)
// ────────────────────────────────────────────────────────────────────
const galeria = [
  { ...IMG.priscila,   alt: 'Priscila — resultado em 7 dias' },
  { ...IMG.gabriela34, alt: 'Gabriela, 34 anos, mãe e trabalha fora de casa' },
  { ...IMG.gilmara,    alt: 'Gilmara, mãe de 3 e vó com neto de 5 anos' },
  { ...IMG.gabriela27, alt: 'Gabriela, 27 anos, com filho autista' },
  { ...IMG.suelen,     alt: 'Suelen, 35 anos, mãe e enfermeira noturna' },
  { ...IMG.thais,      alt: 'Thais, 34 anos' },
  { ...IMG.celia,      alt: 'Célia, 30 anos' },
  { ...IMG.pamela,     alt: 'Pamela, mãe' },
]

export function ProvaSocial() {
  return (
    <section className="py-20 sm:py-24 lg:py-28" style={{ background: '#fff' }}>
      <div className="max-w-[1080px] mx-auto px-5 sm:px-8">
        <div className="text-center max-w-[680px] mx-auto mb-12 sm:mb-14">
          <h2
            className="reveal mb-5"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px,4.2vw,48px)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            O começo que você <span style={{ color: 'var(--o)' }}>sempre adiou!</span>
          </h2>
          <div
            className="reveal reveal-d1 font-display mb-5"
            style={{
              fontSize: 'clamp(48px,8vw,96px)',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              color: 'var(--o)',
            }}
          >
            5.000+
          </div>
          <p
            className="reveal reveal-d1"
            style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--sub)' }}
          >
            Mais de 5.000 mulheres já ativaram o Efeito Lipo e viram o corpo mudar em menos
            de um mês.
          </p>
          <p
            className="reveal reveal-d2 mt-4"
            style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--sub)' }}
          >
            Você vai desinchar, secar a barriga e afinar os braços de um jeito diferente. Em
            apenas 21 dias, você não vai só ver resultado na balança — vai entender por que
            nunca funcionou antes. E por que agora vai funcionar de vez.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {galeria.map((img, i) => (
            <div
              key={i}
              className={`reveal ${i % 2 === 1 ? 'reveal-d1' : ''} overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5`}
              style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.05)',
                background: '#fff',
              }}
            >
              <Image
                src={img.src}
                width={img.w}
                height={img.h}
                sizes="(min-width: 640px) 520px, 92vw"
                alt={img.alt}
                className="block w-full h-auto"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 8 — BÔNUS (fundo creme, 2 cards + stack de valor)
// ────────────────────────────────────────────────────────────────────
const bonusList = [
  {
    nome: 'Bônus 1 — Queima Hormonal',
    de: 'R$ 197',
    para: 'Grátis',
    paragrafos: [
      'Chega de semanas em que você faz tudo certinho e a balança não move nem um grama.',
      'Você vai receber o guia completo das quatro janelas hormonais do ciclo — com tudo que você precisa saber para adaptar alimentação e treino a cada semana do mês, colocando o seu ciclo hormonal para trabalhar ao seu favor, não contra você.',
      'É o passo que faltava para parar de sabotar os próprios resultados sem nem perceber.',
    ],
  },
  {
    nome: 'Bônus 2 — Protocolo Anti-Bananinha',
    de: 'R$ 147',
    para: 'Grátis',
    paragrafos: [
      'Porque nenhuma mulher quer secar rápido e ganhar de brinde a pelinha sobrando.',
      'Você vai descobrir como estimular a produção natural de colágeno e elastina do seu próprio corpo enquanto perde gordura — para que a pele acompanhe o resultado e fique firme e bem coladinha.',
      'Inclui a técnica de massagem linfática express de 3 minutos que você faz em casa, para drenar o excesso de líquido e deixar a barriga visivelmente mais firme logo nos primeiros dias.',
    ],
  },
]

const stackItens = [
  { nome: 'Efeito Lipo 21 (aplicativo completo)', valor: 'R$ 297' },
  { nome: 'Queima Hormonal', valor: 'R$ 197' },
  { nome: 'Protocolo Anti-Bananinha', valor: 'R$ 147' },
]

export function Bonus() {
  return (
    <section className="py-20 sm:py-24 lg:py-28" style={{ background: 'var(--pale)' }}>
      <div className="max-w-[760px] mx-auto px-5 sm:px-8">
        <div className="text-center mb-12 sm:mb-14">
          <h2
            className="reveal mb-5"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(26px,4vw,42px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            Bônus exclusivos para{' '}
            <span style={{ color: 'var(--o)' }}>potencializar seus resultados</span>
          </h2>
          <p
            className="reveal reveal-d1 mx-auto"
            style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--sub)', maxWidth: 620 }}
          >
            O Efeito Lipo 21 foi criado para destravar o metabolismo feminino com método,
            ordem e constância. E para isso, você ainda ganha dois bônus estratégicos que
            completam cada fase do processo:
          </p>
        </div>

        <div className="space-y-5">
          {bonusList.map((b, i) => (
            <div
              key={i}
              className={`reveal ${i === 1 ? 'reveal-d1' : ''}`}
              style={{
                background: '#fff',
                border: '0.5px solid rgba(0,0,0,0.10)',
                borderRadius: 16,
                padding: '1.5rem',
                boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(18px,2.2vw,22px)',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {b.nome}
                </h3>
                <div className="flex items-baseline gap-2">
                  <span style={{ fontSize: 14, color: 'var(--mute)', textDecoration: 'line-through' }}>
                    {b.de}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--g)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    → {b.para}
                  </span>
                </div>
              </div>
              <div className="space-y-3" style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--sub)' }}>
                {b.paragrafos.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Stack de valor */}
        <div
          className="reveal reveal-d2 mx-auto mt-10"
          style={{
            maxWidth: 480,
            background: 'rgba(245,113,0,0.06)',
            border: '1px solid rgba(245,113,0,0.18)',
            borderRadius: 16,
            padding: '1.25rem 1.5rem',
          }}
        >
          <ul className="space-y-2.5">
            {stackItens.map((s, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-3"
                style={{ fontSize: 15, color: 'var(--ink)' }}
              >
                <span>{s.nome}</span>
                <span style={{ color: 'var(--mute)', textDecoration: 'line-through' }}>
                  {s.valor}
                </span>
              </li>
            ))}
            <li
              className="flex items-baseline justify-between gap-3 pt-2.5"
              style={{ borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: 15, color: 'var(--ink)' }}
            >
              <span style={{ fontWeight: 700 }}>Total real</span>
              <span style={{ color: 'var(--mute)', textDecoration: 'line-through', fontWeight: 700 }}>
                R$ 641
              </span>
            </li>
            <li
              className="flex items-baseline justify-between gap-3 pt-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Hoje</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--o)', letterSpacing: '-0.02em' }}>
                R$ 37
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 9 — URGÊNCIA (fundo escuro)
// ────────────────────────────────────────────────────────────────────
export function Urgencia() {
  return (
    <section
      className="relative overflow-hidden py-20 sm:py-24 lg:py-28"
      style={{ background: 'var(--gd)' }}
    >
      <svg
        className="blob-float1 absolute pointer-events-none will-change-transform"
        style={{ bottom: '-20%', left: '-15%', width: 'min(600px,80vw)', height: 'min(600px,80vw)' }}
        viewBox="0 0 400 400"
      >
        <path d="M60,20 C120,-20 220,10 280,60 C340,110 380,180 360,260 C340,340 260,390 180,380 C100,370 20,320 10,240 C0,160 0,60 60,20Z" fill="rgba(245,113,0,0.10)" />
      </svg>

      <div className="relative z-10 max-w-[760px] mx-auto px-5 sm:px-8 text-center text-white">
        <h2
          className="reveal mb-8"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.8vw,52px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            maxWidth: 640,
            margin: '0 auto 32px',
          }}
        >
          É agora ou nunca:{' '}
          <span style={{ color: 'var(--o)' }}>
            essa condição especial vai se encerrar em breve!
          </span>
        </h2>

        <div
          className="reveal reveal-d1 space-y-6"
          style={{ fontSize: 18, lineHeight: 1.7, color: 'rgba(255,255,255,0.82)' }}
        >
          <p>
            Não é sobre secar rápido. É sobre aprender a ordem que você nunca mais vai
            precisar abandonar.
          </p>
          <p>
            Em apenas 21 dias, você vai provar para si mesma que o seu corpo responde —
            quando você dá os estímulos certos, na ordem certa.
          </p>
          <p style={{ color: '#fff', fontWeight: 600 }}>
            Agora é a hora. Essa é a decisão que vai mudar a forma como você se enxerga.
          </p>
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 10 — OFERTA E PREÇO (fundo branco)
// ────────────────────────────────────────────────────────────────────
export function Oferta() {
  return (
    <section className="py-20 sm:py-24 lg:py-28" style={{ background: '#fff' }}>
      <div className="max-w-[640px] mx-auto px-5 sm:px-8 text-center">
        <div
          className="reveal mb-2"
          style={{ fontSize: 18, color: 'var(--mute)', textDecoration: 'line-through' }}
        >
          R$ 297
        </div>
        <div
          className="reveal reveal-d1 font-display"
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--o)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          6x de R$ 8,82
        </div>
        <div
          className="reveal reveal-d1 mt-1 mb-8"
          style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}
        >
          ou R$ 37,00 uma única vez
        </div>

        <div
          className="reveal reveal-d2 text-left mb-8"
          style={{
            background: 'var(--pale)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 16,
            padding: '1rem 1.25rem',
            fontSize: 14.5,
            lineHeight: 1.7,
            color: 'var(--sub)',
          }}
        >
          <p className="flex gap-2 mb-2">
            <span style={{ color: '#c0392b', fontWeight: 700, flexShrink: 0 }}>✗</span>
            <span>Dois meses de academia — R$ 200. Que você já pagou e que não funcionou.</span>
          </p>
          <p className="flex gap-2 mb-2">
            <span style={{ color: '#c0392b', fontWeight: 700, flexShrink: 0 }}>✗</span>
            <span>Uma consulta com nutricionista — a partir de R$ 150.</span>
          </p>
          <p className="flex gap-2 mb-3">
            <span style={{ color: '#c0392b', fontWeight: 700, flexShrink: 0 }}>✗</span>
            <span>Um mês de canetinha — mais de R$ 500. Com chances de ter o efeito rebote.</span>
          </p>
          <p
            className="flex gap-2 pt-3"
            style={{ borderTop: '1px dashed rgba(0,0,0,0.10)', color: 'var(--ink)', fontWeight: 600 }}
          >
            <span style={{ color: 'var(--g)', fontWeight: 700, flexShrink: 0 }}>✓</span>
            <span>Efeito Lipo 21 completo com os 2 bônus — R$ 37.</span>
          </p>
        </div>

        <div className="reveal reveal-d3 mb-5">
          <CtaPill size="lg" ariaLabel="Garantir minha vaga agora">
            Garantir minha vaga agora
          </CtaPill>
        </div>

        <div
          className="reveal reveal-d4"
          style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.7 }}
        >
          🔒 Pagamento 100% seguro via Hotmart · Acesso imediato após confirmação · Pix ou
          cartão parcelado
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// BLOCO 11 — GARANTIA (fundo levemente esverdeado)
// ────────────────────────────────────────────────────────────────────
export function Garantia() {
  return (
    <section
      className="py-20 sm:py-24 lg:py-28"
      style={{ background: 'rgba(28,135,60,0.06)' }}
    >
      <div className="max-w-[640px] mx-auto px-5 sm:px-8 text-center">
        <div
          className="reveal mx-auto mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full"
          style={{ background: 'var(--gd)', color: '#fff' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>

        <h2
          className="reveal reveal-d1 mb-6"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(26px,4vw,40px)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}
        >
          Garantia incondicional de{' '}
          <span style={{ color: 'var(--g)' }}>21 dias</span>
        </h2>

        <div
          className="reveal reveal-d2 space-y-5"
          style={{ fontSize: 16.5, lineHeight: 1.75, color: 'var(--sub)' }}
        >
          <p>Você tem 21 dias para aplicar o protocolo completo e ver resultado.</p>
          <p>Faça a Limpeza. Faça a Ativação. Faça a Queima Total.</p>
          <p>
            Se depois de aplicar os três estímulos você não tiver visto nenhuma mudança — é
            só entrar em contato e devolvemos 100% do seu investimento. Sem perguntas, sem
            burocracia.
          </p>
          <p>
            Eu só ofereço isso porque eu sei que funciona. Eu vejo acontecendo todo dia com
            as mulheres que aplicam na ordem certa.
          </p>
          <p style={{ color: 'var(--ink)', fontWeight: 700 }}>
            A responsabilidade é toda nossa. O risco é zero para você.
          </p>
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// FOOTER
// ────────────────────────────────────────────────────────────────────
export function FooterLipo() {
  return (
    <footer className="py-8 text-center" style={{ background: 'var(--ink)' }}>
      <div className="max-w-[1080px] mx-auto px-5 sm:px-8">
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
          Copyright © 2026, todos os direitos reservados. Efeito Lipo 21, por Laüra Rosa.
        </p>
      </div>
    </footer>
  )
}
