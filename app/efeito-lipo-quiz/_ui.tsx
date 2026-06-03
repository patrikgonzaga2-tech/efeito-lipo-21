'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { BodyVariant, Opt, RegionKey } from './_data'

// ── Hooks ───────────────────────────────────────────────────────────
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(m.matches)
    update()
    m.addEventListener?.('change', update)
    return () => m.removeEventListener?.('change', update)
  }, [])
  return reduced
}

/** Vibração tátil no celular (ignora silenciosamente onde não há suporte). */
export function useHaptics() {
  const reduced = useReducedMotion()
  return useCallback(
    (pattern: number | number[] = 12) => {
      if (reduced) return
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(pattern) } catch { /* noop */ }
      }
    },
    [reduced],
  )
}

// ── Ícones ──────────────────────────────────────────────────────────
const Arrow = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
const Chevron = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
const Check = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 13l4 4L19 7" />
  </svg>
)

// ── Marca / chrome ──────────────────────────────────────────────────
export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="font-display inline-flex items-baseline" style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 17, color: light ? '#fff' : 'var(--ink)' }}>
      Efeito<span style={{ color: 'var(--o)' }}>Lipo</span>
      <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 3, color: light ? 'rgba(255,255,255,.6)' : 'var(--mute)' }}>21</span>
    </div>
  )
}

export function ProgressBar({ value, light }: { value: number; light?: boolean }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: light ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.08)' }}>
      <div style={{ height: '100%', width: `${value}%`, borderRadius: 99, background: 'linear-gradient(90deg,var(--o),var(--g))', transition: 'width .6s var(--ease-out)' }} />
    </div>
  )
}

export function ScreenShell({
  children, progress, light, back, maxWidth = 560,
}: {
  children: ReactNode; progress?: number | null; light?: boolean; back?: () => void; maxWidth?: number
}) {
  const showHeader = progress != null
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: light ? 'var(--gd)' : 'var(--pale)' }}>
      {showHeader && (
        <header className="sticky top-0 z-30" style={{ backdropFilter: 'blur(10px)', background: light ? 'rgba(0,72,17,.55)' : 'rgba(247,245,242,.82)' }}>
          <div className="mx-auto w-full flex items-center gap-3 px-4 py-3" style={{ maxWidth }}>
            {back ? (
              <button onClick={back} aria-label="Voltar" className="flex-shrink-0 grid place-items-center rounded-full transition-colors active:scale-90"
                style={{ width: 34, height: 34, color: light ? '#fff' : 'var(--ink)', background: light ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.05)' }}>
                <Chevron />
              </button>
            ) : <span style={{ width: 34 }} className="flex-shrink-0" />}
            <div className="flex-1"><ProgressBar value={progress} light={light} /></div>
            <Logo light={light} />
          </div>
        </header>
      )}
      <main className="flex-1 flex flex-col w-full mx-auto" style={{ maxWidth, padding: 'clamp(18px,4.5vw,30px)' }}>
        {children}
      </main>
    </div>
  )
}

// ── Botões ──────────────────────────────────────────────────────────
export function CtaButton({
  children, onClick, href, size = 'lg', glow, full, variant = 'orange', disabled, dataLabel,
}: {
  children: ReactNode; onClick?: () => void; href?: string; size?: 'md' | 'lg'; glow?: boolean
  full?: boolean; variant?: 'orange' | 'green'; disabled?: boolean; dataLabel?: string
}) {
  const bg = disabled ? 'rgba(0,0,0,.18)' : variant === 'green' ? 'var(--g)' : 'var(--o)'
  const fg = disabled ? 'rgba(0,0,0,.4)' : variant === 'green' ? '#fff' : '#000'
  const style: CSSProperties = {
    padding: size === 'lg' ? 'clamp(17px,2.2vw,21px) clamp(30px,4vw,46px)' : '13px 26px',
    background: bg, color: fg, fontSize: size === 'lg' ? 'clamp(16px,2vw,19px)' : 15,
    boxShadow: disabled ? 'none' : variant === 'green' ? '0 10px 30px rgba(28,135,60,.34)' : '0 10px 34px rgba(245,113,0,.38)',
  }
  const cls = `font-display inline-flex items-center justify-center gap-2.5 font-bold rounded-full transition-all duration-300 ${disabled ? 'cursor-not-allowed' : 'active:scale-[.97] hover:-translate-y-0.5'} ${glow && !disabled ? 'q-glow' : ''} ${full ? 'w-full' : ''}`
  if (href) {
    return (
      <a href={href} onClick={onClick} target="_blank" rel="noopener noreferrer" data-cta={dataLabel} className={cls} style={style}>
        {children}<Arrow />
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-cta={dataLabel} className={cls} style={style}>
      {children}<Arrow />
    </button>
  )
}

// ── Silhuetas (ilustrações de corpo) ────────────────────────────────
function RegionHi({ region }: { region: RegionKey }) {
  const fill = 'rgba(245,113,0,.55)'
  if (region === 'none') return null
  if (region === 'full') return <rect x="22" y="6" width="56" height="150" rx="26" fill="rgba(245,113,0,.22)" className="q-floaty" />
  const shapes: Record<Exclude<RegionKey, 'none' | 'full'>, ReactNode> = {
    belly: <ellipse cx="50" cy="80" rx="15" ry="12" fill={fill} />,
    arms: <><ellipse cx="29" cy="68" rx="6" ry="17" fill={fill} /><ellipse cx="71" cy="68" rx="6" ry="17" fill={fill} /></>,
    waist: <ellipse cx="50" cy="74" rx="22" ry="8" fill={fill} />,
    hips: <ellipse cx="50" cy="104" rx="20" ry="14" fill={fill} />,
  }
  return <g className="q-floaty">{shapes[region as Exclude<RegionKey, 'none' | 'full'>]}</g>
}

export function Body({ variant = 'soft', highlight, size = 88, color }: { variant?: BodyVariant; highlight?: RegionKey; size?: number; color?: string }) {
  const scale = { lean: 0.82, soft: 1, over: 1.18, much: 1.34 }[variant]
  return (
    <svg viewBox="0 0 100 160" width={size} height={size * 1.6} aria-hidden style={{ display: 'block' }}>
      <g transform={`translate(50 0) scale(${scale} 1) translate(-50 0)`} fill={color || 'currentColor'}>
        <circle cx="50" cy="20" r="13" />
        <path d="M50 35 C39 35 32 42 32 55 C32 67 37 74 37 86 C31 104 30 128 36 150 L45 150 C43 130 47 112 50 106 C53 112 57 130 55 150 L64 150 C70 128 69 104 63 86 C63 74 68 67 68 55 C68 42 61 35 50 35 Z" />
      </g>
      {highlight && <RegionHi region={highlight} />}
    </svg>
  )
}

// ── Cartões de opção ────────────────────────────────────────────────
export function OptionCard({
  opt, selected, onClick, mode, layout, index,
}: {
  opt: Opt; selected: boolean; onClick: () => void; mode: 'single' | 'multi'
  layout: 'plain' | 'chips' | 'body' | 'region'; index: number
}) {
  const base: CSSProperties = {
    background: '#fff',
    border: selected ? '2px solid var(--o)' : '1px solid rgba(0,0,0,0.10)',
    boxShadow: selected ? '0 14px 36px rgba(245,113,0,.20)' : '0 3px 14px rgba(0,0,0,.05)',
    transition: 'all .25s var(--ease-out)',
    animationDelay: `${index * 55}ms`,
  }

  // Marcador (check para selecionado, seta/quadrado para não)
  const marker = (
    <span className="flex-shrink-0 grid place-items-center rounded-full" style={{
      width: 28, height: 28,
      background: selected ? 'var(--o)' : 'rgba(0,0,0,.05)',
      color: selected ? '#000' : 'var(--mute)',
    }}>
      {selected ? <span className="q-check"><Check s={15} /></span> : mode === 'multi' ? <span style={{ width: 11, height: 11, borderRadius: 3, border: '2px solid currentColor' }} /> : <Arrow s={14} />}
    </span>
  )

  if (layout === 'chips') {
    return (
      <button type="button" onClick={onClick} className="q-in text-center rounded-2xl p-5 active:scale-[.97]" style={base}>
        <div className="grid place-items-center mx-auto mb-3 rounded-2xl" style={{ width: 56, height: 56, fontSize: 28, background: selected ? 'var(--o)' : `${opt.tint || 'var(--o)'}1A` }}>
          <span className={selected ? 'q-pop' : ''}>{opt.emoji}</span>
        </div>
        <div className="font-display" style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', lineHeight: 1.2 }}>{opt.label}</div>
      </button>
    )
  }

  if (layout === 'body') {
    return (
      <button type="button" onClick={onClick} className="q-in flex flex-col items-center text-center rounded-2xl p-4 active:scale-[.97]" style={base}>
        <div className="grid place-items-center mb-2" style={{ height: 132, color: selected ? 'var(--o)' : 'rgba(0,0,0,.32)', transition: 'color .25s' }}>
          <Body variant={opt.body} size={76} />
        </div>
        <div className="font-display" style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.25 }}>{opt.label}</div>
        {opt.sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 4, lineHeight: 1.35 }}>{opt.sub}</div>}
      </button>
    )
  }

  if (layout === 'region') {
    return (
      <button type="button" onClick={onClick} className="q-in flex flex-col items-center text-center rounded-2xl p-3 active:scale-[.97]" style={base}>
        <div className="grid place-items-center mb-1" style={{ height: 104, color: selected ? 'var(--o)' : 'rgba(0,0,0,.3)', transition: 'color .25s' }}>
          <Body variant="soft" size={58} highlight={selected ? opt.region : undefined} />
        </div>
        <div className="font-display flex items-center gap-1.5" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.2 }}>
          {selected && <span style={{ color: 'var(--o)' }}><Check s={13} /></span>}{opt.label}
        </div>
      </button>
    )
  }

  // plain (lista)
  return (
    <button type="button" onClick={onClick} className="q-in flex items-center gap-3.5 text-left rounded-2xl p-4 active:scale-[.98]" style={base}>
      {opt.emoji && (
        <span className="flex-shrink-0 grid place-items-center rounded-xl" style={{ width: 46, height: 46, fontSize: 24, background: selected ? 'rgba(245,113,0,.14)' : 'var(--pale)' }}>
          <span className={selected ? 'q-pop' : ''}>{opt.emoji}</span>
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="font-display block" style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', lineHeight: 1.3 }}>{opt.label}</span>
        {opt.sub && <span className="block" style={{ fontSize: 13.5, color: 'var(--sub)', marginTop: 2, lineHeight: 1.4 }}>{opt.sub}</span>}
      </span>
      {marker}
    </button>
  )
}

// ── Número que sobe contando ─────────────────────────────────────────
export function CountUp({ to, duration = 1400, suffix = '', className, style }: { to: number; duration?: number; suffix?: string; className?: string; style?: CSSProperties }) {
  const [v, setV] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) { setV(to); return }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(e * to))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, duration, reduced])
  return <span className={className} style={style}>{v}{suffix}</span>
}

// ── Medidor radial ──────────────────────────────────────────────────
export function Gauge({ value, size = 208 }: { value: number; size?: number }) {
  const r = 84
  const c = 2 * Math.PI * r
  const reduced = useReducedMotion()
  const [off, setOff] = useState(c)
  useEffect(() => {
    const t = setTimeout(() => setOff(c * (1 - value / 100)), reduced ? 0 : 150)
    return () => clearTimeout(t)
  }, [value, c, reduced])
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(0,0,0,.07)" strokeWidth="16" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="url(#gaugeGrad)" strokeWidth="16" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1.7s var(--ease-out)' }} />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F57100" /><stop offset="1" stopColor="#1C873C" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp to={value} suffix="%" className="font-display" style={{ fontSize: 52, fontWeight: 800, color: 'var(--g)', letterSpacing: '-0.03em', lineHeight: 1 }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 4 }}>de chance</span>
      </div>
    </div>
  )
}

// ── Confete ─────────────────────────────────────────────────────────
export function Confetti({ fire }: { fire: boolean }) {
  const reduced = useReducedMotion()
  const [pieces, setPieces] = useState<ReactNode[]>([])
  useEffect(() => {
    if (!fire || reduced) { setPieces([]); return }
    const colors = ['#F57100', '#1C873C', '#FFC53D', '#004811', '#FF8A3D', '#fff']
    const arr = Array.from({ length: 90 }, (_, i) => {
      const left = Math.random() * 100
      const dx = (Math.random() * 2 - 1) * 140
      const rot = Math.random() * 720 + 360
      const dur = 2.2 + Math.random() * 1.9
      const delay = Math.random() * 0.45
      const sz = 6 + Math.random() * 9
      const round = Math.random() > 0.5
      return (
        <span key={i} className="q-confetti-piece" style={{
          position: 'absolute', top: '-5vh', left: `${left}%`, width: sz, height: round ? sz : sz * 1.7,
          background: colors[i % colors.length], borderRadius: round ? '50%' : 2,
          ['--dx' as string]: `${dx}px`, ['--rot' as string]: `${rot}deg`, ['--dur' as string]: `${dur}s`, ['--delay' as string]: `${delay}s`,
        } as CSSProperties} />
      )
    })
    setPieces(arr)
    const t = setTimeout(() => setPieces([]), 4600)
    return () => clearTimeout(t)
  }, [fire, reduced])
  if (!pieces.length) return null
  return <div aria-hidden className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 70 }}>{pieces}</div>
}

export { Arrow, Chevron, Check }
