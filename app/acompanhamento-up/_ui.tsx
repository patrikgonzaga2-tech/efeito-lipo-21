'use client'

// Peças interativas do upsell /acompanhamento-up. São client por causa do
// rastreio (dataLayer do GTM), do contador regressivo e do reveal on-scroll.
// O visual (cores, tipografia) mora todo em page.tsx — aqui só comportamento.

import { useEffect, useRef, useState, type ReactNode } from 'react'

// ── Rastreio ──────────────────────────────────────────────────────────────
function track(event: string, extra: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ event, ...extra })
}

// Visualização da página, uma única vez: dispara o evento no GTM E grava a
// visualização no Supabase (beacon /api/upsell) — é a etapa "foram pra página
// de upsell" do funil pós-compra no dashboard. id de sessão insert-ignore, então
// recargas não recontam.
const VIEW_ID_KEY = 'acompanhamento_up_vid'
export function Pageview() {
  useEffect(() => {
    track('acompanhamento_up_pageview')
    try {
      let vid = sessionStorage.getItem(VIEW_ID_KEY)
      if (!vid) {
        vid = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
        sessionStorage.setItem(VIEW_ID_KEY, vid)
      }
      const q = new URLSearchParams(window.location.search)
      const xcod = q.get('xcod') || q.get('utm_content') || undefined
      fetch('/api/upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ id: vid, slug: 'acompanhamento-up', xcod }),
      }).catch(() => { /* beacon best-effort */ })
    } catch { /* ignore */ }
  }, [])
  return null
}

// ── Player de vídeo (VTurb / ConverteAI) ─────────────────────────────────────
// Lazy: o player (web component pesado, ~7 MB) só carrega quando a cliente
// clica no play — a página abre leve. Enquanto isso mostramos um pôster escuro
// com botão de play (mesmo padrão da /efeito-lipo).
//  1) no clique, injetamos o script v4/player.js uma única vez (guard por id);
//  2) renderizamos a tag do player + placeholder via innerHTML — React não
//     conhece elementos customizados, então dangerouslySetInnerHTML é o caminho
//     limpo. O padding-top de 55.74% mantém o aspect ratio (~16:9).
const VTURB_PLAYER_ID = 'vid-6a51640fed97cc5fbffc0288'
const VTURB_SCRIPT_ID = 'vturb-6a51640fed97cc5fbffc0288'
const VTURB_SRC =
  'https://scripts.converteai.net/9406f62d-bd68-44a6-971a-c0a91bdff3c8/players/6a51640fed97cc5fbffc0288/v4/player.js'

export function VturbPlayer() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!loaded) return
    if (document.getElementById(VTURB_SCRIPT_ID)) return
    const s = document.createElement('script')
    s.id = VTURB_SCRIPT_ID
    s.src = VTURB_SRC
    s.async = true
    document.head.appendChild(s)
  }, [loaded])

  return (
    <div
      style={{
        position: 'relative', maxWidth: 560, width: '100%',
        margin: 'clamp(28px,5.5vw,36px) auto 0',
        borderRadius: 20, overflow: 'hidden', lineHeight: 0,
        border: '1px solid rgba(255,255,255,.09)',
        boxShadow: '0 28px 66px rgba(0,0,0,.55)',
        background: '#000',
        ...(loaded ? {} : { aspectRatio: '16 / 9' }),
      }}
    >
      {loaded ? (
        <div
          style={{ width: '100%' }}
          dangerouslySetInnerHTML={{
            __html:
              `<vturb-smartplayer id="${VTURB_PLAYER_ID}" style="display:block;margin:0 auto;width:100%;">` +
              `<div class="vturb-player-placeholder" style="position:relative;width:100%;padding:55.74074074074075% 0 0;z-index:0;background-color:black;"></div>` +
              `</vturb-smartplayer>`,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label="Assistir ao vídeo do comunicado"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 18, cursor: 'pointer',
            border: 0, padding: 0,
            background: 'radial-gradient(60% 60% at 50% 45%, rgba(245,113,0,.16), transparent 70%), #100E0C',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'grid', placeItems: 'center',
              width: 'clamp(64px,11vw,88px)', height: 'clamp(64px,11vw,88px)',
              borderRadius: '50%', background: 'var(--o)',
              boxShadow: '0 8px 32px rgba(245,113,0,.5)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="#000" width="38%" height="38%" style={{ marginLeft: '8%' }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span
            className="font-display"
            style={{
              color: '#fff', fontSize: 'clamp(13px,3.4vw,15px)',
              letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700,
              textShadow: '0 2px 8px rgba(0,0,0,.6)', lineHeight: 1,
            }}
          >
            Assista agora
          </span>
        </button>
      )}
    </div>
  )
}

// ── Reveal on-scroll ────────────────────────────────────────────────────────
// Envolve um bloco e o revela quando entra na viewport. A transição (e o
// respeito a prefers-reduced-motion) vem das classes .reveal/.show do
// globals.css. <noscript> na page garante conteúdo visível sem JS.
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('show'); return }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { el.classList.add('show'); io.unobserve(el) }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className="reveal" style={{ width: '100%' }}>{children}</div>
}

// ── Contador regressivo ──────────────────────────────────────────────────────
// DEV NOTE (copy): "só implementar se a expiração for real". Aqui a janela é
// real dentro da sessão: o prazo é gravado no sessionStorage no 1º carregamento,
// então recarregar NÃO reinicia o relógio — ele continua de onde parou e para
// em 00:00. Abrir uma nova sessão reinicia (comportamento padrão de upsell).
const DEADLINE_KEY = 'acompanhamento_up_deadline'
const WINDOW_MIN = 15

export function CountdownPill({
  bg, color, border,
}: { bg: string; color: string; border: string }) {
  const [left, setLeft] = useState(WINDOW_MIN * 60) // 15:00 no SSR e no 1º paint
  useEffect(() => {
    let deadline: number
    const now = Date.now()
    try {
      const saved = sessionStorage.getItem(DEADLINE_KEY)
      if (saved && Number(saved) > now) {
        deadline = Number(saved)
      } else {
        deadline = now + WINDOW_MIN * 60 * 1000
        sessionStorage.setItem(DEADLINE_KEY, String(deadline))
      }
    } catch {
      deadline = now + WINDOW_MIN * 60 * 1000
    }
    const tick = () => setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: bg, color, border: `1px solid ${border}`,
        borderRadius: 999, padding: '10px 20px',
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: 'clamp(15px,3.6vw,17px)', letterSpacing: '.01em',
      }}
    >
      <span aria-hidden style={{ fontSize: '1.05em' }}>⏳</span>
      <span>Essa condição expira em</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1.12em', letterSpacing: '.04em' }}>
        {mm}:{ss}
      </span>
    </div>
  )
}

// ── CTA de checkout — Greenn One-Click Buy ───────────────────────────────────
// Botão de compra em 1 clique da Greenn. O comportamento (a cobrança no cartão
// que a cliente já usou no Efeito Lipo) é injetado pelo "Modal de Compra" da
// Greenn — ver o <Script> em page.tsx —, que define a função global
// startLoading() e processa os atributos data-greenn-*. Aqui só marcamos o
// botão com o ID da oferta e disparamos startLoading no clique; o design (pill
// verde) e a copy continuam nossos.
//
// IMPORTANTE: o one-click só cobra se a página for aberta pelo redirect da
// Greenn após a compra (é assim que ela reconhece a sessão/cartão da cliente).
const GREENN_UPSELL_ID = '6097'

export function CheckoutCta({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <button
        type="button"
        data-greenn-one-click="false"
        data-greenn-upsell={GREENN_UPSELL_ID}
        data-greenn-split="1"
        data-loading="false"
        data-cta={label}
        onClick={(e) => {
          track('acompanhamento_up_cta_click', { local: label })
          // dispara o fluxo de cobrança em 1 clique da Greenn, se o modal já carregou
          const w = window as unknown as { startLoading?: (el: HTMLElement) => void }
          w.startLoading?.(e.currentTarget)
        }}
        aria-label="Comprar em 1 clique — acompanhamento com a Laüra"
        className="font-display inline-flex items-center justify-center gap-2 font-bold rounded-full transition-all duration-300 active:scale-[.97] hover:-translate-y-0.5"
        style={{
          width: '100%', maxWidth: 460, border: 'none', cursor: 'pointer',
          padding: 'clamp(17px,2.6vw,20px) clamp(26px,5vw,40px)',
          fontSize: 'clamp(15.5px,2.2vw,18px)', lineHeight: 1.2,
          textAlign: 'center', color: '#04300F',
          background: 'linear-gradient(135deg,#2BE36F,#16BA50)',
          boxShadow: '0 16px 46px rgba(37,211,102,.36)',
        }}
      >
        {children}
        <span aria-hidden style={{ fontSize: '1.05em' }}>→</span>
      </button>
    </div>
  )
}
