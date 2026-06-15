'use client'

// CTAs do upsell Corpo Feliz. São client por causa do rastreio (push no
// dataLayer do GTM) e do clique que abre o WhatsApp. O destino é o mesmo
// contato usado no funil /cf-whats (wa.link/secacomigo3).

import { useEffect } from 'react'

const WHATSAPP_HREF = 'https://wa.link/secacomigo3?utm_source=whatsapp&utm_medium=upsell'

function track(event: string, extra: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ event, ...extra })
}

// Dispara a visualização do upsell no GTM, uma única vez.
export function UpsellPageview() {
  useEffect(() => { track('upsell_cf_pageview') }, [])
  return null
}

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43l-.48-.01c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  )
}

export function WaCta({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <a
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('upsell_cf_cta_click', { local: label })}
        data-cta={label}
        aria-label="Falar com a Laüra no WhatsApp e garantir a vaga na Comunidade Corpo Feliz"
        className="font-display inline-flex items-center justify-center gap-2.5 font-bold rounded-full transition-all duration-300 active:scale-[.97] hover:-translate-y-0.5"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 'clamp(16px,2.4vw,19px) clamp(26px,5vw,40px)',
          fontSize: 'clamp(15.5px,2.1vw,18px)',
          lineHeight: 1.2,
          textAlign: 'center',
          color: '#04300F',
          background: 'linear-gradient(135deg,#2BE36F,#16BA50)',
          boxShadow: '0 14px 42px rgba(37,211,102,.42)',
        }}
      >
        <WhatsAppIcon />
        {children}
      </a>
    </div>
  )
}
