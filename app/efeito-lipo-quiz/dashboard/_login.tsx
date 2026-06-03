'use client'

import { useState } from 'react'

export default function Login({ configured }: { configured: boolean }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const r = await fetch('/api/quiz/dashboard-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (r.ok) location.reload()
      else setErr('Senha incorreta.')
    } catch {
      setErr('Erro ao entrar. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5" style={{ background: 'var(--gd)' }}>
      <form onSubmit={submit} className="w-full" style={{ maxWidth: 380 }}>
        <div className="rounded-3xl p-7" style={{ background: '#fff', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
          <div className="font-display text-center" style={{ fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>
            Dashboard <span style={{ color: 'var(--o)' }}>Efeito Lipo</span>
          </div>
          <p className="text-center" style={{ fontSize: 13.5, color: 'var(--sub)', margin: '6px 0 20px' }}>Área restrita — informe a senha.</p>
          {!configured && (
            <p className="rounded-xl p-3 mb-4" style={{ fontSize: 12.5, background: 'rgba(197,57,0,.08)', color: '#c0392b', lineHeight: 1.5 }}>
              ⚠️ A variável <code>QUIZ_DASHBOARD_PASSWORD</code> não está configurada no servidor.
            </p>
          )}
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Senha"
            autoFocus
            className="w-full rounded-xl outline-none"
            style={{ padding: '14px 16px', fontSize: 16, border: '2px solid rgba(0,0,0,.12)', background: 'var(--pale)' }}
          />
          {err && <p style={{ fontSize: 13, color: '#c0392b', marginTop: 8 }}>{err}</p>}
          <button
            type="submit"
            disabled={loading || !pw}
            className="font-display w-full rounded-full font-bold mt-4 transition-all active:scale-[.98]"
            style={{ padding: '15px', fontSize: 16, color: '#000', background: loading || !pw ? 'rgba(0,0,0,.18)' : 'var(--o)', boxShadow: '0 8px 24px rgba(245,113,0,.3)' }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
