// Helper do cliente: envia os dados do quiz para a API interna (/api/quiz),
// que grava no Supabase. A chave secreta nunca passa por aqui.

export type QuizContext = {
  variante?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  xcod?: string
  sck?: string
  referrer?: string
  user_agent?: string
}

const SID_KEY = 'el_quiz_sid'

export function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let v = sessionStorage.getItem(SID_KEY)
  if (!v) {
    v = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    sessionStorage.setItem(SID_KEY, v)
  }
  return v
}

export function captureContext(): QuizContext {
  if (typeof window === 'undefined') return {}
  const p = new URLSearchParams(window.location.search)
  const g = (k: string) => p.get(k) || undefined
  // Redundância: persiste o id do anúncio na gaveta já no início do quiz, pro
  // botão de compra achá-lo no clique mesmo se a URL sumir depois.
  try { const t = g('utm_term'); if (t) sessionStorage.setItem('el_utm_term', t) } catch { /* ignore */ }
  // xcod (user_id_purchase): da URL (onde o GTM injeta) ou da gaveta do navegador.
  let xcod: string | undefined
  try { xcod = g('xcod') || window.localStorage.getItem('user_id_purchase') || undefined } catch { /* ignore */ }
  return {
    variante: g('variante'),
    utm_source: g('utm_source'),
    utm_medium: g('utm_medium'),
    utm_campaign: g('utm_campaign'),
    utm_content: g('utm_content'),
    utm_term: g('utm_term'),
    xcod,
    sck: g('sck'),
    referrer: document.referrer || undefined,
    user_agent: navigator.userAgent,
  }
}

export function persist(body: Record<string, unknown>): void {
  try {
    fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* nunca quebra a experiência do quiz */
  }
}
