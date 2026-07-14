'use client'

import { useState, useMemo } from 'react'

export type VUtm = {
  received_at: string; product_name: string | null; price: number; sck: string | null; src: string | null
  utm_source: string | null; utm_campaign: string | null; utm_medium: string | null; utm_content: string | null
}

const N = (v: unknown) => Number(v) || 0
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
// Decodifica UTM (vem url-encoded, com + no lugar de espaço).
const dec = (s: string | null): string => {
  if (!s) return ''
  try { return decodeURIComponent(s.replace(/\+/g, ' ')) } catch { return s.replace(/\+/g, ' ') }
}
const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Dimensões cruzáveis. keyOf já devolve o rótulo final (com fallback p/ sem
// rastreio), então o "balde sem rastreio" também é clicável e filtrável.
type Dim = { id: string; title: string; keyOf: (v: VUtm) => string }
const DIMS: Dim[] = [
  { id: 'sck',      title: 'Funil (sck)',           keyOf: (v) => v.sck || '(sem sck)' },
  { id: 'source',   title: 'Origem (utm_source)',   keyOf: (v) => dec(v.utm_source) || '(sem rastreio / orgânico)' },
  { id: 'campaign', title: 'Campanha (utm_campaign)', keyOf: (v) => dec(v.utm_campaign) || '(sem rastreio)' },
  // Conjunto pelo ID, não pelo nome. No Meta os nomes se repetem à exaustão:
  // 149 conjuntos reais viravam 13 linhas, e "ABERTO" sozinho carregava
  // R$ 22 mil como se fosse um conjunto só. O id (src) é o que distingue.
  { id: 'adset_id', title: 'Conjunto (ID)',         keyOf: (v) => v.src || '(sem rastreio)' },
  { id: 'medium',   title: 'Conjunto (nome)',       keyOf: (v) => dec(v.utm_medium) || '(sem rastreio)' },
  { id: 'content',  title: 'Anúncio (utm_content)', keyOf: (v) => dec(v.utm_content) || '(sem rastreio)' },
]
const DIM_LABEL: Record<string, string> = { sck: 'Funil', source: 'Origem', campaign: 'Campanha', adset_id: 'Conjunto (ID)', medium: 'Conjunto', content: 'Anúncio' }

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: accent || 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// Tabela de uma dimensão: linha clicável que liga/desliga o filtro daquela dimensão.
function Breakdown({ dim, rows, selected, onPick }: { dim: Dim; rows: VUtm[]; selected: string | null; onPick: (key: string) => void }) {
  const map = new Map<string, { vendas: number; receita: number }>()
  for (const v of rows) {
    const k = dim.keyOf(v)
    const e = map.get(k) || { vendas: 0, receita: 0 }
    e.vendas += 1; e.receita += N(v.price)
    map.set(k, e)
  }
  const totalReceita = [...map.values()].reduce((a, e) => a + e.receita, 0)
  const items = [...map.entries()].map(([k, e]) => ({ k, ...e })).sort((a, b) => b.receita - a.receita)
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: 'var(--ink)' }
  return (
    <section className="mt-7">
      <h2 className="font-display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>{dim.title}</h2>
      <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
            <th style={{ ...td, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)', fontWeight: 700 }}>{dim.title}</th>
            <th style={{ ...td, textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>Vendas</th>
            <th style={{ ...td, textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>Receita</th>
            <th style={{ ...td, textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>% receita</th>
          </tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--mute)', padding: 18 }}>Sem vendas.</td></tr>}
            {items.map((it) => {
              const active = selected === it.k
              return (
                <tr key={it.k} onClick={() => onPick(it.k)} title={active ? 'Clique pra remover o filtro' : 'Clique pra filtrar por isto'}
                  style={{ borderTop: '1px solid rgba(0,0,0,.05)', cursor: 'pointer', background: active ? 'rgba(245,113,0,.10)' : undefined }}>
                  <td style={{ ...td, fontWeight: active ? 800 : 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', color: active ? 'var(--o)' : 'var(--ink)' }}>
                    {active ? '✓ ' : ''}{it.k}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{it.vendas}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{brl0(it.receita)}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--sub)' }}>{pct(it.receita, totalReceita)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function UtmExplorer({ vendas }: { vendas: VUtm[] }) {
  // Filtro ativo por dimensão (E entre dimensões diferentes).
  const [filters, setFilters] = useState<Record<string, string>>({})

  const pick = (dimId: string, key: string) =>
    setFilters((f) => (f[dimId] === key ? (() => { const n = { ...f }; delete n[dimId]; return n })() : { ...f, [dimId]: key }))
  const clear = () => setFilters({})

  // Conjunto totalmente filtrado (todas as dimensões ativas) — alimenta cards e detalhe.
  const fullyFiltered = useMemo(
    () => vendas.filter((v) => DIMS.every((d) => !filters[d.id] || d.keyOf(v) === filters[d.id])),
    [vendas, filters],
  )
  // Para a lista de CADA dimensão, aplica todos os filtros MENOS o dela mesma —
  // assim a lista clicada mantém suas opções e só as OUTRAS se estreitam.
  const rowsForDim = (dimId: string) =>
    vendas.filter((v) => DIMS.every((d) => d.id === dimId || !filters[d.id] || d.keyOf(v) === filters[d.id]))

  const totalVendas = fullyFiltered.length
  const totalReceita = fullyFiltered.reduce((a, v) => a + N(v.price), 0)
  const comUtm = fullyFiltered.filter((v) => v.utm_source || v.utm_campaign).length
  const activeKeys = Object.keys(filters)

  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap' }

  return (
    <>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Card label="Vendas" value={String(totalVendas)} sub={activeKeys.length ? 'no filtro atual' : 'reais (Hotmart)'} />
        <Card label="Receita" value={brl0(totalReceita)} sub={activeKeys.length ? 'no filtro atual' : 'no período'} accent="var(--g)" />
        <Card label="Com UTM" value={`${pct(comUtm, totalVendas)}%`} sub={`${comUtm} de ${totalVendas} com origem identificada`} accent="var(--o)" />
      </div>

      {/* Barra de filtros ativos */}
      {activeKeys.length > 0 && (
        <div className="rounded-xl p-3 mt-4 flex flex-wrap items-center" style={{ gap: 8, background: 'rgba(245,113,0,.07)', border: '1px solid rgba(245,113,0,.18)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Filtros:</span>
          {activeKeys.map((id) => (
            <button key={id} onClick={() => pick(id, filters[id])}
              style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--o)', background: '#fff', border: '1px solid rgba(245,113,0,.35)', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>
              {DIM_LABEL[id]}: {filters[id]} ✕
            </button>
          ))}
          <button onClick={clear} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--sub)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>limpar tudo</button>
        </div>
      )}

      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
        💡 <strong>Clique em qualquer linha</strong> pra filtrar todas as outras listas por aquela origem (funil, campanha, conjunto, anúncio). Dá pra combinar filtros de dimensões diferentes. O UTM completo só existe nas vendas com rastreio novo (desde 19/06); vendas anteriores ou orgânicas aparecem como <em>sem rastreio</em>. O funil (sck) está em todas.
      </div>

      {DIMS.map((d) => (
        <Breakdown key={d.id} dim={d} rows={rowsForDim(d.id)} selected={filters[d.id] ?? null} onPick={(k) => pick(d.id, k)} />
      ))}

      {/* Detalhe: cada venda com a cadeia completa de UTM (respeita os filtros) */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Detalhe das vendas {activeKeys.length ? `(${totalVendas})` : ''}</h2>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              {['Quando', 'Produto', 'Valor', 'Funil', 'Origem', 'Campanha', 'Conjunto', 'Anúncio'].map((h) => <th key={h} style={{ ...td, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {fullyFiltered.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--mute)', padding: 18 }}>Sem vendas no filtro atual.</td></tr>}
              {fullyFiltered.slice(0, 120).map((v, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                  <td style={td}>{fmtDate(v.received_at)}</td>
                  <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.product_name || '—'}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{brl0(N(v.price))}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{v.sck || '—'}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{dec(v.utm_source) || '—'}</td>
                  <td style={{ ...td, color: 'var(--sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dec(v.utm_campaign) || '—'}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{dec(v.utm_medium) || '—'}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{dec(v.utm_content) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {fullyFiltered.length > 120 && <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8 }}>Mostrando as 120 mais recentes de {totalVendas}.</p>}
      </section>
    </>
  )
}
