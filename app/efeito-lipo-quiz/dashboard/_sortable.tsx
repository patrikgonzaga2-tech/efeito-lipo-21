'use client'

import { useState } from 'react'

// Tabela com ordenação por clique no cabeçalho (métricas + status).
// Recebe linhas já com os números crus; calcula derivadas (CPM, CTR, CPA…) aqui.
export type Metrics = { spend: number; impressions: number; link_clicks: number; lp_views: number; ic: number; purchases: number; purchase_value: number }
export type Row = { id: string; lead: (string | null)[]; status?: string; m: Metrics }

const brl = (n: number) => 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')

type Def = { key: string; label: string; val: (m: Metrics) => number; fmt: (m: Metrics) => string; color?: (m: Metrics) => string; bold?: boolean }
const METRICS: Def[] = [
  { key: 'spend', label: 'Investido', val: (m) => m.spend, fmt: (m) => brl0(m.spend) },
  { key: 'impressions', label: 'Impr.', val: (m) => m.impressions, fmt: (m) => int(m.impressions) },
  { key: 'cpm', label: 'CPM', val: (m) => (m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0), fmt: (m) => (m.impressions > 0 ? brl((m.spend / m.impressions) * 1000) : '—') },
  { key: 'link_clicks', label: 'Cliques', val: (m) => m.link_clicks, fmt: (m) => int(m.link_clicks) },
  { key: 'ctr', label: 'CTR', val: (m) => (m.impressions > 0 ? m.link_clicks / m.impressions : 0), fmt: (m) => pct1(m.link_clicks, m.impressions) },
  { key: 'cpc', label: 'CPC', val: (m) => (m.link_clicks > 0 ? m.spend / m.link_clicks : 0), fmt: (m) => (m.link_clicks > 0 ? brl(m.spend / m.link_clicks) : '—') },
  { key: 'lp_views', label: 'Page views', val: (m) => m.lp_views, fmt: (m) => int(m.lp_views) },
  { key: 'ic', label: 'IC', val: (m) => m.ic, fmt: (m) => int(m.ic) },
  { key: 'purchases', label: 'Compras', val: (m) => m.purchases, fmt: (m) => int(m.purchases), bold: true },
  { key: 'cpa', label: 'CPA', val: (m) => (m.purchases > 0 ? m.spend / m.purchases : 0), fmt: (m) => (m.purchases > 0 ? brl(m.spend / m.purchases) : '—') },
  { key: 'roas', label: 'ROAS', val: (m) => (m.spend > 0 ? m.purchase_value / m.spend : 0), fmt: (m) => (m.purchase_value > 0 ? (m.purchase_value / m.spend).toFixed(2) + 'x' : '—'), color: (m) => (m.purchase_value <= 0 ? 'var(--mute)' : m.purchase_value / m.spend >= 1 ? 'var(--g)' : '#c0392b') },
]
const statusRank = (s?: string) => (s === 'ACTIVE' ? 0 : s === 'DISAPPROVED' ? 1 : 2)

function StatusBadge({ status }: { status?: string }) {
  const s = status || ''
  let txt = 'Pausado', bg = 'rgba(0,0,0,.06)', fg = 'var(--mute)'
  if (s === 'ACTIVE') { txt = 'Ativo'; bg = 'rgba(0,114,38,.12)'; fg = 'var(--g)' }
  else if (s === 'DISAPPROVED') { txt = 'Reprovado'; bg = 'rgba(192,57,43,.1)'; fg = '#c0392b' }
  else if (!s) { txt = '—'; bg = 'transparent' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: bg, color: fg, whiteSpace: 'nowrap' }}>{txt}</span>
}

const thL: React.CSSProperties = { padding: '9px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...thL, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }
const tdL: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: 'var(--ink)', textAlign: 'left', whiteSpace: 'nowrap' }
const tdR: React.CSSProperties = { ...tdL, textAlign: 'right' }

export function SortableTable({ leadHead, rows, showRank, hasStatus, defaultSort }: { leadHead: string[]; rows: Row[]; showRank?: boolean; hasStatus?: boolean; defaultSort?: string }) {
  const [sortKey, setSortKey] = useState(defaultSort || 'spend')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const toggle = (k: string) => { if (sortKey === k) setDir((d) => (d === 'desc' ? 'asc' : 'desc')); else { setSortKey(k); setDir('desc') } }
  const arrow = (k: string) => (sortKey === k ? (dir === 'desc' ? ' ↓' : ' ↑') : '')

  const sorted = [...rows].sort((a, b) => {
    const av = sortKey === 'status' ? statusRank(a.status) : (METRICS.find((x) => x.key === sortKey)?.val(a.m) ?? 0)
    const bv = sortKey === 'status' ? statusRank(b.status) : (METRICS.find((x) => x.key === sortKey)?.val(b.m) ?? 0)
    return dir === 'desc' ? bv - av : av - bv
  })

  const colSpan = (showRank ? 1 : 0) + leadHead.length + (hasStatus ? 1 : 0) + METRICS.length
  return (
    <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
            {showRank && <th style={thL}>#</th>}
            {leadHead.map((h, i) => <th key={i} style={thL}>{h}</th>)}
            {hasStatus && <th style={{ ...thL, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggle('status')}>Status{arrow('status')}</th>}
            {METRICS.map((md) => <th key={md.key} style={thR} onClick={() => toggle(md.key)} title="Clique para ordenar">{md.label}{arrow(md.key)}</th>)}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={colSpan} style={{ ...tdL, textAlign: 'center', color: 'var(--mute)', padding: 20 }}>Sem dados no período.</td></tr>}
          {sorted.map((r, i) => (
            <tr key={r.id} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
              {showRank && <td style={{ ...tdL, color: 'var(--mute)', fontWeight: 700 }}>{i + 1}</td>}
              {r.lead.map((c, j) => <td key={j} style={{ ...tdL, fontWeight: j === 0 ? 600 : undefined, color: j === 0 ? 'var(--ink)' : 'var(--sub)', fontSize: j === 0 ? 13 : 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c || '—'}</td>)}
              {hasStatus && <td style={tdL}><StatusBadge status={r.status} /></td>}
              {METRICS.map((md) => <td key={md.key} style={{ ...tdR, fontWeight: md.bold ? 800 : undefined, color: md.color?.(r.m) }}>{md.fmt(r.m)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
