'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  CHECKOUT_HREF, IMG, INSIGHT, LAURA_PARAGRAFOS, PROVA_GRID,
  RESULT_MARCOS, SALES, STEPS,
} from './_data'
import type { ImgKey, Step } from './_data'
import {
  Confetti, CtaButton, CountUp, Gauge, Logo, OptionCard, ProgressBar,
  ScreenShell, useHaptics, useReducedMotion,
} from './_ui'
import { captureContext, getSessionId, persist } from './_track'

// ── Rastreio GTM (dataLayer) ────────────────────────────────────────
function track(event: string, extra: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ event, ...extra })
}

// ════════════════════════════════════════════════════════════════════
export default function QuizApp() {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [busy, setBusy] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const busyRef = useRef(false)
  const sidRef = useRef('')
  const pvRef = useRef(false)
  const answersRef = useRef(answers)
  const buzz = useHaptics()
  const step = STEPS[index]

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { sidRef.current = getSessionId() }, [])

  // Pageview da 1ª tela: registra quem ENTRA na intro, mesmo que nunca
  // clique em "Iniciar". Dispara uma única vez por sessão. É o topo do funil.
  useEffect(() => {
    if (pvRef.current) return
    if (STEPS[index]?.kind !== 'intro') return
    pvRef.current = true
    persist({ id: sidRef.current, action: 'pageview', ...captureContext() })
    track('quiz_pageview')
  }, [index])

  // Pré-visualização: /efeito-lipo-quiz?step=N abre direto numa tela específica.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('step')
    if (s) {
      const n = parseInt(s, 10)
      if (Number.isFinite(n)) setIndex(Math.max(0, Math.min(STEPS.length - 1, n)))
    }
  }, [])

  useEffect(() => {
    busyRef.current = false
    setBusy(false)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [index])

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(STEPS.length - 1, i))), [])
  const next = useCallback(() => setIndex((i) => Math.min(STEPS.length - 1, i + 1)), [])
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  const answerSingle = useCallback((stepId: string, optId: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    buzz(16)
    const nextAnswers = { ...answersRef.current, [stepId]: optId }
    setAnswers(nextAnswers)
    track('quiz_step', { step_id: stepId, step_index: index, answer: optId })
    persist({ id: sidRef.current, action: 'step', step_id: stepId, step_index: index, answer: optId, answers: nextAnswers, reached_index: index })
    window.setTimeout(() => setIndex((i) => Math.min(STEPS.length - 1, i + 1)), 460)
  }, [buzz, index])

  const toggleMulti = useCallback((stepId: string, optId: string) => {
    buzz(10)
    setAnswers((a) => {
      const cur = (a[stepId] as string[]) || []
      return { ...a, [stepId]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] }
    })
  }, [buzz])

  const submitMulti = useCallback((stepId: string) => {
    const answer = ((answers[stepId] as string[]) || []).join(',')
    track('quiz_step', { step_id: stepId, step_index: index, answer })
    persist({ id: sidRef.current, action: 'step', step_id: stepId, step_index: index, answer, answers: answersRef.current, reached_index: index })
    next()
  }, [answers, index, next])

  const setInput = useCallback((stepId: string, val: string) => {
    setAnswers((a) => ({ ...a, [stepId]: val }))
  }, [])

  // Personalização a partir de peso/altura
  const perfil = useMemo(() => {
    const peso = Number(answers['peso'])
    const altura = Number(answers['altura'])
    const hasPeso = !isNaN(peso) && peso > 0
    const perda = hasPeso ? Math.min(8, Math.max(4, Math.round(peso * 0.1))) : 8
    const meta = hasPeso ? peso - perda : 0
    const imc = hasPeso && altura > 0 ? peso / Math.pow(altura / 100, 2) : 0
    return { peso, altura, hasPeso, perda, meta, imc }
  }, [answers])

  // Conclusão do quiz: grava no banco quando chega na tela de resultado.
  useEffect(() => {
    if (step.kind === 'result') {
      persist({
        id: sidRef.current, action: 'complete',
        altura: Number.isFinite(perfil.altura) && perfil.altura > 0 ? perfil.altura : null,
        peso: perfil.hasPeso ? perfil.peso : null,
        meta_peso: perfil.hasPeso ? perfil.meta : null,
        answers: answersRef.current, reached_index: index,
      })
    }
  }, [step.kind]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Telas full-page (sem shell padrão) ────────────────────────────
  if (step.kind === 'intro') {
    return <Intro onStart={() => { persist({ id: sidRef.current, action: 'start', ...captureContext() }); track('quiz_start'); next() }} />
  }
  if (step.kind === 'sales') {
    return <Sales perfil={perfil} onCheckout={() => { persist({ id: sidRef.current, action: 'checkout' }); track('initiate_checkout', { variante: 'efeito-lipo-quiz' }) }} />
  }

  const darkBg = step.kind === 'loading' || step.kind === 'result'
  const canBack = ['single', 'multi', 'laura', 'prova', 'insight', 'input'].includes(step.kind) && index > 0

  return (
    <>
      <ScreenShell progress={step.progress} light={darkBg} back={canBack ? back : undefined}>
        <Inner
          key={step.id}
          step={step}
          answers={answers}
          perfil={perfil}
          busy={busy}
          onSingle={answerSingle}
          onToggle={toggleMulti}
          onSubmitMulti={submitMulti}
          onInput={setInput}
          onNext={next}
          onResultReady={() => setConfetti(true)}
        />
      </ScreenShell>
      <Confetti fire={confetti} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════
// Roteador das telas internas (dentro do shell)
// ════════════════════════════════════════════════════════════════════
type InnerProps = {
  step: Step
  answers: Record<string, string | string[]>
  perfil: { peso: number; hasPeso: boolean; perda: number; meta: number; imc: number }
  busy: boolean
  onSingle: (s: string, o: string) => void
  onToggle: (s: string, o: string) => void
  onSubmitMulti: (s: string) => void
  onInput: (s: string, v: string) => void
  onNext: () => void
  onResultReady: () => void
}

function Inner(p: InnerProps) {
  const { step } = p
  switch (step.kind) {
    case 'single':
    case 'multi':
      return <Question {...p} />
    case 'laura':
      return <Laura onNext={p.onNext} />
    case 'prova':
      return <Prova onNext={p.onNext} />
    case 'insight':
      return <Insight onSingle={p.onSingle} />
    case 'loading':
      return <LoadingScreen step={step} onDone={p.onNext} />
    case 'input':
      return <NumberInput step={step} value={(p.answers[step.id] as string) || ''} onChange={(v) => p.onInput(step.id, v)} onSubmit={p.onNext} />
    case 'result':
      return <Result perfil={p.perfil} onNext={p.onNext} onReady={p.onResultReady} />
    default:
      return null
  }
}

// ── Cabeçalho de tela ───────────────────────────────────────────────
function Heading({ title, sub, light }: { title: string; sub?: string; light?: boolean }) {
  return (
    <div className="text-center mb-6 q-in">
      <h2 className="font-display" style={{ fontSize: 'clamp(21px,4.6vw,29px)', fontWeight: 800, lineHeight: 1.16, letterSpacing: '-0.02em', color: light ? '#fff' : 'var(--ink)' }}>{title}</h2>
      {sub && <p style={{ fontSize: 14.5, lineHeight: 1.55, color: light ? 'rgba(255,255,255,.78)' : 'var(--sub)', marginTop: 10, maxWidth: 460, marginInline: 'auto' }}>{sub}</p>}
    </div>
  )
}

// ── Pergunta (single / multi) ───────────────────────────────────────
function Question(p: InnerProps) {
  const step = p.step
  if (step.kind !== 'single' && step.kind !== 'multi') return null
  const isMulti = step.kind === 'multi'
  const sel = p.answers[step.id]
  const selected = (o: string) => (isMulti ? ((sel as string[]) || []).includes(o) : sel === o)
  const grid = step.layout === 'plain'
    ? 'flex flex-col gap-3'
    : 'grid grid-cols-2 gap-3'
  const count = isMulti ? ((sel as string[]) || []).length : 0

  return (
    <div className="flex flex-col flex-1">
      <Heading title={step.headline} sub={step.sub} />
      <div className={grid}>
        {step.options.map((o, i) => (
          <OptionCard
            key={o.id}
            opt={o}
            index={i}
            mode={isMulti ? 'multi' : 'single'}
            layout={step.layout === 'plain' ? 'plain' : step.layout === 'chips' ? 'chips' : step.layout === 'body' ? 'body' : 'region'}
            selected={selected(o.id)}
            onClick={() => (isMulti ? p.onToggle(step.id, o.id) : p.onSingle(step.id, o.id))}
          />
        ))}
      </div>
      {isMulti && (
        <div className="sticky bottom-3 mt-6 pt-2">
          <CtaButton full disabled={count === 0} onClick={() => p.onSubmitMulti(step.id)}>
            {count === 0 ? 'Selecione uma opção' : 'Continuar'}
          </CtaButton>
        </div>
      )}
    </div>
  )
}

// ── Foto helper ─────────────────────────────────────────────────────
function Photo({ img, alt, ratio = '1 / 1', priority, className }: { img: ImgKey; alt: string; ratio?: string; priority?: boolean; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className || ''}`} style={{ aspectRatio: ratio }}>
      <Image src={IMG[img]} alt={alt} fill sizes="(max-width: 560px) 92vw, 520px" priority={priority} className="object-cover" />
    </div>
  )
}

// ── T3 — Laura ──────────────────────────────────────────────────────
function Laura({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col flex-1 q-in">
      <Heading title="Quem vai montar o seu protocolo" />
      <div className="mx-auto w-full mb-6" style={{ maxWidth: 240, borderRadius: 22, overflow: 'hidden', boxShadow: '0 14px 40px rgba(0,0,0,.16)' }}>
        <Photo img="laura" alt="Laüra Rosa" ratio="1984 / 2976" priority />
      </div>
      <div className="space-y-3.5" style={{ fontSize: 15.5, lineHeight: 1.65, color: 'var(--sub)' }}>
        {LAURA_PARAGRAFOS.map((t, i) => (
          <p key={i} style={i === 0 ? { color: 'var(--ink)', fontWeight: 600 } : i === 2 ? { color: 'var(--ink)', fontWeight: 700 } : undefined}>{t}</p>
        ))}
      </div>
      <div className="mt-7"><CtaButton full onClick={onNext}>Continuar</CtaButton></div>
    </div>
  )
}

// ── T9 — Prova social ───────────────────────────────────────────────
function Prova({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col flex-1 q-in">
      <Heading title="Enquanto você responde, veja o que está acontecendo com outras mulheres" />
      <p className="text-center" style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--sub)', maxWidth: 460, margin: '0 auto 20px' }}>
        Essas são as minhas seguidoras. Com rotinas reais. Cansadas de tentar emagrecer com dietas malucas e academia — e que, depois dessa avaliação, descobriram o que estava travando o corpo. Você pode estar com o mesmo problema.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {PROVA_GRID.map((g, i) => (
          <div key={i} className="q-in rounded-2xl overflow-hidden" style={{ boxShadow: '0 6px 22px rgba(0,0,0,.1)', border: '1px solid rgba(0,0,0,.05)', animationDelay: `${i * 70}ms` }}>
            <Photo img={g.img} alt={g.alt} ratio="1 / 1" />
          </div>
        ))}
      </div>
      <p className="text-center font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '22px auto 0', maxWidth: 420, lineHeight: 1.4 }}>
        Mais de <span style={{ color: 'var(--o)' }}>5.000 mulheres</span> já ativaram o Efeito Lipo e viram o corpo transformar em menos de um mês.
      </p>
      <div className="mt-7"><CtaButton full onClick={onNext}>Continuar</CtaButton></div>
    </div>
  )
}

// ── T15 — Insight (educativa) ───────────────────────────────────────
function Insight({ onSingle }: { onSingle: (s: string, o: string) => void }) {
  return (
    <div className="flex flex-col flex-1 q-in">
      <Heading title={INSIGHT.headline} />
      <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 6px 22px rgba(0,0,0,.05)' }}>
        <p style={{ fontSize: 14.5, color: 'var(--sub)', marginBottom: 12 }}>{INSIGHT.intro}</p>
        <ul className="space-y-2.5 mb-3">
          {INSIGHT.ruins.map((t, i) => (
            <li key={i} className="flex gap-2.5" style={{ fontSize: 14.5, lineHeight: 1.45, color: 'var(--sub)' }}>
              <span style={{ color: '#c0392b', fontWeight: 700, flexShrink: 0 }}>✗</span><span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2.5 pt-3" style={{ borderTop: '1px dashed rgba(0,0,0,.1)', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)', fontWeight: 600 }}>
          <span style={{ color: 'var(--g)', fontWeight: 700, flexShrink: 0 }}>✓</span><span>{INSIGHT.bom}</span>
        </div>
        <p className="font-display" style={{ marginTop: 12, fontWeight: 800, color: 'var(--o)', fontSize: 16 }}>{INSIGHT.fecho}</p>
      </div>
      <div className="flex flex-col gap-3 mt-5">
        {INSIGHT.options.map((o, i) => (
          <OptionCard key={o.id} opt={o} index={i} mode="single" layout="plain" selected={false} onClick={() => onSingle('insight', o.id)} />
        ))}
      </div>
    </div>
  )
}

// ── T16 / T24 — Loading ─────────────────────────────────────────────
function LoadingScreen({ step, onDone }: { step: Extract<Step, { kind: 'loading' }>; onDone: () => void }) {
  const [pct, setPct] = useState(0)
  const [tick, setTick] = useState(0)
  const reduced = useReducedMotion()
  const done = useRef(false)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    if (!step.carousel) return
    const n = step.carousel.images.length
    const id = window.setInterval(() => setSlide((s) => (s + 1) % n), 1500)
    return () => clearInterval(id)
  }, [step.carousel])

  useEffect(() => {
    const total = reduced ? 500 : 3400
    const t0 = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const p = Math.min(100, ((now - t0) / total) * 100)
      setPct(p)
      if (p < 100) raf = requestAnimationFrame(loop)
      else if (!done.current) { done.current = true; window.setTimeout(onDone, 250) }
    }
    raf = requestAnimationFrame(loop)
    const ti = window.setInterval(() => setTick((t) => (t + 1) % step.ticks.length), 1050)
    return () => { cancelAnimationFrame(raf); clearInterval(ti) }
  }, [reduced, step.ticks.length, onDone])

  return (
    <div className="relative flex flex-col flex-1 items-center justify-center text-center overflow-hidden" style={{ minHeight: '70vh' }}>
      <div className="absolute inset-0 -z-10" style={{ opacity: 0.18 }}>
        <Image src={IMG[step.bg]} alt="" fill sizes="100vw" className="object-cover" style={{ filter: 'blur(6px)' }} />
      </div>
      <div className="q-in" style={{ maxWidth: 440 }}>
        {!step.carousel && (
          <div className="mx-auto mb-6 grid place-items-center rounded-full q-floaty" style={{ width: 64, height: 64, background: 'rgba(255,255,255,.12)', border: '2px solid rgba(255,255,255,.25)' }}>
            <span style={{ fontSize: 30 }}>⚙️</span>
          </div>
        )}
        <h2 className="font-display" style={{ fontSize: 'clamp(22px,5vw,30px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginTop: step.carousel ? 4 : 0 }}>{step.title}</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,.8)', margin: '12px auto 22px' }}>{step.body}</p>

        {step.carousel && (
          <div className="mx-auto mb-6" style={{ maxWidth: 264 }}>
            <p className="font-display" style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>“{step.carousel.caption}”</p>
            <div className="relative rounded-2xl overflow-hidden mx-auto" style={{ aspectRatio: '1 / 1', boxShadow: '0 14px 40px rgba(0,0,0,.4)' }}>
              {step.carousel.images.map((img, i) => (
                <Image
                  key={img}
                  src={IMG[img]}
                  alt="Resultado real da Laüra Rosa com o Efeito Lipo"
                  fill
                  sizes="(max-width: 560px) 80vw, 264px"
                  priority={i === 0}
                  className="object-cover"
                  style={{ opacity: slide === i ? 1 : 0, transition: 'opacity .6s var(--ease-out)' }}
                />
              ))}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {step.carousel.images.map((_, i) => (
                <span key={i} style={{ width: slide === i ? 18 : 7, height: 7, borderRadius: 99, background: slide === i ? 'var(--o)' : 'rgba(255,255,255,.35)', transition: 'all .3s' }} />
              ))}
            </div>
          </div>
        )}
        <div className="w-full rounded-full overflow-hidden mb-3" style={{ height: 12, background: 'rgba(255,255,255,.18)' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: 'linear-gradient(90deg,var(--o),#FFC53D,var(--g))' }} />
        </div>
        <div className="flex items-center justify-between" style={{ color: 'rgba(255,255,255,.9)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{step.ticks[tick]}</span>
          <span className="font-display" style={{ fontSize: 15, fontWeight: 800 }}>{Math.round(pct)}%</span>
        </div>
      </div>
    </div>
  )
}

// ── T22 / T23 — Input numérico ──────────────────────────────────────
function NumberInput({ step, value, onChange, onSubmit }: { step: Extract<Step, { kind: 'input' }>; value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const num = Number(value)
  const valid = value !== '' && !isNaN(num) && num >= step.min && num <= step.max
  return (
    <div className="flex flex-col flex-1 q-in">
      <Heading title={step.headline} sub={step.sub} />
      <div className="relative mx-auto w-full my-4" style={{ maxWidth: 280 }}>
        <input
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
          onKeyDown={(e) => { if (e.key === 'Enter' && valid) onSubmit() }}
          placeholder={step.placeholder}
          aria-label={step.headline}
          className="font-display w-full text-center rounded-2xl outline-none transition-all"
          style={{ fontSize: 40, fontWeight: 800, color: 'var(--ink)', padding: '22px 56px 22px 22px', background: '#fff', border: `2px solid ${valid ? 'var(--o)' : 'rgba(0,0,0,.12)'}`, boxShadow: valid ? '0 12px 32px rgba(245,113,0,.16)' : '0 4px 16px rgba(0,0,0,.05)' }}
        />
        <span className="font-display absolute" style={{ right: 22, top: '50%', transform: 'translateY(-50%)', fontSize: 22, fontWeight: 700, color: 'var(--mute)' }}>{step.unit}</span>
      </div>
      <div className="mt-auto pt-4">
        <CtaButton full disabled={!valid} onClick={onSubmit}>Continuar</CtaButton>
      </div>
    </div>
  )
}

// ── T25 — Resultado ─────────────────────────────────────────────────
function Result({ perfil, onNext, onReady }: { perfil: InnerProps['perfil']; onNext: () => void; onReady: () => void }) {
  useEffect(() => {
    track('quiz_complete', { peso: perfil.hasPeso ? perfil.peso : undefined, meta: perfil.hasPeso ? perfil.meta : undefined })
    onReady()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col flex-1 q-in">
      <div className="rounded-3xl p-5 sm:p-7" style={{ background: '#fff', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div className="text-center mb-5">
          <span className="inline-block font-display" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--g)', background: 'rgba(28,135,60,.1)', padding: '6px 14px', borderRadius: 99 }}>
            ✓ Avaliação concluída
          </span>
          <h2 className="font-display mt-3" style={{ fontSize: 'clamp(23px,5vw,32px)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Seu Protocolo Efeito Lipo<br /><span style={{ color: 'var(--o)' }}>está pronto!</span>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--sub)', marginTop: 8 }}>Com base no seu perfil, calculamos o seu potencial de resultado nos 21 dias:</p>
        </div>

        <Gauge value={94} />
        <p className="text-center" style={{ fontSize: 12.5, color: 'var(--mute)', maxWidth: 320, margin: '8px auto 0', lineHeight: 1.45 }}>
          Probabilidade de resultado com o Efeito Lipo, baseada em mulheres com perfil similar ao seu.
        </p>

        {perfil.hasPeso && (
          <div className="flex items-center justify-center gap-4 mt-6 mb-2 rounded-2xl py-4" style={{ background: 'var(--pale)' }}>
            <div className="text-center">
              <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--mute)' }}>{perfil.peso}<span style={{ fontSize: 14 }}>kg</span></div>
              <div style={{ fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.06em' }}>hoje</div>
            </div>
            <div style={{ color: 'var(--o)' }}><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></div>
            <div className="text-center">
              <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: 'var(--g)' }}>~<CountUp to={perfil.meta} duration={1600} /><span style={{ fontSize: 14 }}>kg</span></div>
              <div style={{ fontSize: 11, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>em 21 dias</div>
            </div>
          </div>
        )}

        <h3 className="font-display text-center mt-7 mb-4" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>Sua jornada de transformação</h3>
        <Chart />

        <div className="mt-5 space-y-3">
          {RESULT_MARCOS.map((m, i) => (
            <div key={i} className="flex gap-3 q-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex flex-col items-center flex-shrink-0">
                <span className="grid place-items-center rounded-full font-display" style={{ width: 30, height: 30, fontSize: 11, fontWeight: 800, color: '#fff', background: i === RESULT_MARCOS.length - 1 ? 'var(--g)' : 'var(--o)' }}>{i + 1}</span>
                {i < RESULT_MARCOS.length - 1 && <span style={{ flex: 1, width: 2, background: 'rgba(0,0,0,.1)', marginTop: 2 }} />}
              </div>
              <div className="pb-1">
                <div className="font-display" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{m.dia} · <span style={{ color: 'var(--o)' }}>{m.fase}</span></div>
                <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.45 }}>{m.txt}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7"><CtaButton full glow onClick={onNext}>Acessar meu protocolo</CtaButton></div>
      </div>
    </div>
  )
}

function Chart() {
  const reduced = useReducedMotion()
  const [off, setOff] = useState(1)
  useEffect(() => { const t = setTimeout(() => setOff(0), reduced ? 0 : 200); return () => clearTimeout(t) }, [reduced])
  const W = 320, H = 170, pad = 16
  const pts = RESULT_MARCOS.map((m, i) => ({
    x: pad + i * ((W - 2 * pad) / (RESULT_MARCOS.length - 1)),
    y: H - pad - (m.y / 100) * (H - 2 * pad),
  }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x} ${H - pad} L${pts[0].x} ${H - pad} Z`
  const colorAt = (i: number) => (i <= 1 ? '#E5484D' : i === 2 ? '#FFC53D' : i === 3 ? '#F57100' : '#1C873C')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E5484D" /><stop offset=".5" stopColor="#FFC53D" /><stop offset="1" stopColor="#1C873C" />
        </linearGradient>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(245,113,0,.22)" /><stop offset="1" stopColor="rgba(245,113,0,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaGrad)" opacity={off === 0 ? 1 : 0} style={{ transition: 'opacity .8s ease 1s' }} />
      <path d={line} fill="none" stroke="url(#lineGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1.6s var(--ease-out)' }} />
      {pts.map((pt, i) => (
        <g key={i} opacity={off === 0 ? 1 : 0} style={{ transition: `opacity .3s ease ${0.4 + i * 0.25}s` }}>
          <circle cx={pt.x} cy={pt.y} r="5.5" fill="#fff" stroke={colorAt(i)} strokeWidth="3" />
        </g>
      ))}
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════
// T26 — Página de vendas
// ════════════════════════════════════════════════════════════════════
function useCountdown(start = 600) {
  const [s, setS] = useState(start)
  useEffect(() => { const t = setInterval(() => setS((x) => (x > 0 ? x - 1 : 0)), 1000); return () => clearInterval(t) }, [])
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function Sales({ perfil, onCheckout }: { perfil: InnerProps['perfil']; onCheckout: () => void }) {
  const timer = useCountdown(600)

  const Price = () => (
    <div className="mx-auto rounded-2xl p-5" style={{ maxWidth: 360, background: 'rgba(245,113,0,.06)', border: '1px solid rgba(245,113,0,.2)' }}>
      <ul className="space-y-2">
        {SALES.stack.map(([n, v], i) => (
          <li key={i} className="flex justify-between" style={{ fontSize: 14.5, color: 'var(--ink)' }}><span>{n}</span><span style={{ color: 'var(--mute)', textDecoration: 'line-through' }}>{v}</span></li>
        ))}
        <li className="flex justify-between pt-2" style={{ borderTop: '1px solid rgba(0,0,0,.1)', fontSize: 14.5, fontWeight: 700 }}><span>Total real</span><span style={{ color: 'var(--mute)', textDecoration: 'line-through' }}>R$ 641</span></li>
        <li className="flex justify-between items-baseline pt-2 font-display"><span style={{ fontSize: 16, fontWeight: 800 }}>Hoje</span><span style={{ fontSize: 30, fontWeight: 800, color: 'var(--o)' }}>R$ 37</span></li>
      </ul>
      <p className="text-center" style={{ fontSize: 13, color: 'var(--sub)', marginTop: 6 }}>ou 5x de R$ 8,19</p>
    </div>
  )

  return (
    <div style={{ background: 'var(--pale)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 text-center py-2.5 px-4" style={{ background: 'var(--gd)', color: '#fff' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>⏳ Sua condição especial expira em <strong className="font-display" style={{ color: '#FFC53D' }}>{timer}</strong></span>
      </header>

      <div className="mx-auto px-5 py-8" style={{ maxWidth: 600 }}>
        <div className="text-center"><Logo /></div>

        {/* Resultado personalizado */}
        <h1 className="font-display text-center mt-5" style={{ fontSize: 'clamp(25px,5.4vw,38px)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          Seu Protocolo Efeito Lipo<br /><span style={{ color: 'var(--o)' }}>21 dias está pronto!</span>
        </h1>
        <p className="text-center" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--sub)', maxWidth: 480, margin: '14px auto 0' }}>
          {perfil.hasPeso
            ? <>Com base no seu perfil, você vai receber tudo para sair dos <strong>{perfil.peso}kg</strong> rumo aos <strong style={{ color: 'var(--g)' }}>~{perfil.meta}kg</strong> em 21 dias — sem academia, sem passar fome e sem as canetinhas caras.</>
            : <>Com base no seu perfil, você vai receber tudo que precisa para perder até 8kg em 21 dias — sem academia, sem passar fome e sem as canetinhas caras.</>}
        </p>

        <div className="mt-7"><a href={CHECKOUT_HREF} onClick={onCheckout} target="_blank" rel="noopener noreferrer" className="block"><CtaButton full glow dataLabel="topo">Quero meu protocolo agora</CtaButton></a></div>

        {/* Antes / Depois */}
        <SectionTitle>Antes e depois do Efeito Lipo</SectionTitle>
        <div className="space-y-2.5">
          {SALES.beforeAfter.map(([a, b], i) => (
            <div key={i} className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl p-3.5" style={{ background: 'rgba(197,57,0,.06)', border: '1px solid rgba(197,57,0,.14)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#c0392b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>✗ Antes</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--sub)' }}>{a}</div>
              </div>
              <div className="rounded-xl p-3.5" style={{ background: 'rgba(28,135,60,.07)', border: '1px solid rgba(28,135,60,.16)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>✓ Depois</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--ink)' }}>{b}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Galeria */}
        <SectionTitle>Resultados reais de alunas</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {SALES.gallery.map((g, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
              <Photo img={g.img} alt={g.alt} ratio="3 / 4" />
              {g.tag && <span className="absolute top-1.5 left-1.5 font-display" style={{ fontSize: 10, fontWeight: 800, color: '#000', background: '#FFC53D', padding: '2px 7px', borderRadius: 99 }}>{g.tag}</span>}
            </div>
          ))}
        </div>

        {/* Entregáveis */}
        <SectionTitle>🎁 Seu protocolo está pronto — você já pode começar hoje</SectionTitle>
        <div className="space-y-2.5">
          {SALES.entregaveis.map(([t, d], i) => (
            <div key={i} className="flex gap-3 rounded-xl p-3.5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
              <span style={{ color: 'var(--g)', flexShrink: 0, marginTop: 1 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg></span>
              <div><div className="font-display" style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{t}</div><div style={{ fontSize: 13.5, color: 'var(--sub)', lineHeight: 1.45, marginTop: 2 }}>{d}</div></div>
            </div>
          ))}
        </div>

        {/* Bônus */}
        <SectionTitle>Bônus exclusivos</SectionTitle>
        <div className="space-y-2.5">
          {SALES.bonus.map((b, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid rgba(245,113,0,.2)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-1 mb-1.5">
                <span className="font-display" style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>🎁 {b.nome}</span>
                <span><span style={{ fontSize: 13, color: 'var(--mute)', textDecoration: 'line-through' }}>{b.de}</span> <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--g)' }}>→ GRÁTIS</span></span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--sub)', lineHeight: 1.45 }}>{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Prova social */}
        <div className="text-center mt-9">
          <div style={{ fontSize: 22, letterSpacing: 2 }}>⭐⭐⭐⭐⭐</div>
          <p className="font-display" style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginTop: 6 }}>Baseado em mais de 5.000 transformações reais</p>
          <p style={{ fontSize: 13.5, color: 'var(--sub)', maxWidth: 420, margin: '6px auto 0', lineHeight: 1.5 }}>Mulheres com filho, rotina impossível, SOP, acima dos 40 — que já tentaram de tudo e achavam que não conseguiriam.</p>
        </div>

        {/* Preço + urgência */}
        <div className="text-center mt-9">
          <div className="inline-block mb-4" style={{ fontSize: 13, fontWeight: 800, color: '#c0392b', background: 'rgba(197,57,0,.08)', padding: '7px 16px', borderRadius: 99 }}>🔴 Válido apenas enquanto esta página estiver aberta · {timer}</div>
        </div>
        <Price />
        <div className="mt-6"><a href={CHECKOUT_HREF} onClick={onCheckout} target="_blank" rel="noopener noreferrer" className="block"><CtaButton full glow dataLabel="preco">Quero meu protocolo agora</CtaButton></a></div>
        <p className="text-center" style={{ fontSize: 12, color: 'var(--mute)', marginTop: 12, lineHeight: 1.6 }}>🔒 Pagamento 100% seguro via Hotmart · Acesso imediato · Pix ou cartão</p>

        {/* Garantia */}
        <div className="mt-9 rounded-2xl p-6 text-center" style={{ background: 'rgba(28,135,60,.06)', border: '1px solid rgba(28,135,60,.15)' }}>
          <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: 52, height: 52, background: 'var(--gd)', color: '#fff' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
          </div>
          <h3 className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>Garantia de 21 dias</h3>
          <p style={{ fontSize: 14, color: 'var(--sub)', lineHeight: 1.6, marginTop: 8 }}>Aplique o protocolo completo. Se depois das três fases você não tiver visto nenhuma mudança — é só entrar em contato e devolvemos 100% do seu investimento. Sem perguntas, sem burocracia.</p>
          <p className="font-display" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginTop: 10 }}>A responsabilidade é toda minha. O risco é zero para você.</p>
        </div>

        {/* CTA final */}
        <div className="text-center mt-9">
          <p className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Protocolo Efeito Lipo 21 <span style={{ color: 'var(--mute)', textDecoration: 'line-through' }}>R$ 297</span> → <span style={{ color: 'var(--o)' }}>R$ 37 à vista</span></p>
          <div className="mt-4"><a href={CHECKOUT_HREF} onClick={onCheckout} target="_blank" rel="noopener noreferrer" className="block"><CtaButton full glow variant="green" dataLabel="final">Garantir minha vaga agora</CtaButton></a></div>
          <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 12, lineHeight: 1.6 }}>🔒 Pagamento 100% seguro · Acesso imediato após confirmação · Pix ou cartão</p>
        </div>

        <footer className="text-center mt-10 pt-6" style={{ borderTop: '1px solid rgba(0,0,0,.08)' }}>
          <p style={{ fontSize: 11.5, color: 'var(--mute)', lineHeight: 1.7 }}>Copyright © 2026, todos os direitos reservados.<br />Efeito Lipo 21, por Laüra Rosa.</p>
        </footer>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-center" style={{ fontSize: 'clamp(19px,4vw,24px)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '40px auto 18px', maxWidth: 460 }}>{children}</h2>
}

// ── T1 — Intro ──────────────────────────────────────────────────────
function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: 'var(--gd)' }}>
      <div className="w-full text-center px-4 py-2.5" style={{ background: 'var(--g)', color: '#fff', fontSize: 13.5, fontWeight: 700, letterSpacing: '.01em' }}>
        🔺 Atenção: resultado de emagrecimento iminente!
      </div>
      <div className="flex-1 flex flex-col items-center text-center mx-auto w-full px-5 py-8" style={{ maxWidth: 600 }}>
        <Logo light />
        <h1 className="font-display q-in mt-7" style={{ fontSize: 'clamp(26px,5.6vw,40px)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.025em', color: '#fff', maxWidth: 540 }}>
          O segredo que as blogueiras e atrizes usam para <span style={{ color: 'var(--o)' }}>secar a barriga e afinar os braços</span> — e que a maioria dos profissionais nunca vai te contar
        </h1>
        <p className="q-in" style={{ fontSize: 'clamp(15px,2.2vw,17px)', lineHeight: 1.6, color: 'rgba(255,255,255,.8)', maxWidth: 480, marginTop: 16 }}>
          Faça a avaliação gratuita e descubra como ativar o Efeito Lipo e queimar até 8kg de gordura em 21 dias comendo comida de verdade — sem academia e sem as canetinhas caras.
        </p>
        <div className="q-in w-full mt-7 mb-7" style={{ maxWidth: 360, borderRadius: 22, overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,.4)' }}>
          <div className="relative" style={{ aspectRatio: '1 / 1' }}>
            <Image src={IMG.intro} alt="Antes e depois — resultado real com o Efeito Lipo" fill sizes="(max-width: 560px) 86vw, 360px" priority className="object-cover" />
          </div>
        </div>
        <CtaButton onClick={onStart} glow size="lg">Iniciar avaliação gratuita</CtaButton>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 14, letterSpacing: '.02em' }}>Leva menos de 3 minutos • 100% gratuito</p>
      </div>
    </div>
  )
}
