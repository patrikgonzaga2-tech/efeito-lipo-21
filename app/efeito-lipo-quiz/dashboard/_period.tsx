// Helpers de período compartilhados pelas abas (fuso de Brasília -03:00).
export type SearchParams = { range?: string; from?: string; to?: string }

export function resolvePeriod(sp: SearchParams): { since: string; until: string; range: string; periodLabel: string } {
  const range = sp.range || 'mes'
  const spToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const nowIso = new Date().toISOString()
  if (range === 'custom' && (sp.from || sp.to)) {
    return { range, since: `${sp.from || spToday}T00:00:00-03:00`, until: `${sp.to || spToday}T23:59:59-03:00`, periodLabel: `${sp.from || '…'} até ${sp.to || '…'}` }
  }
  if (range === 'hoje') return { range, since: `${spToday}T00:00:00-03:00`, until: nowIso, periodLabel: 'hoje' }
  if (range === 'all') return { range, since: '2020-01-01T00:00:00-03:00', until: nowIso, periodLabel: 'todo o período' }
  if (range === '7d') return { range, since: new Date(Date.now() - 7 * 86_400_000).toISOString(), until: nowIso, periodLabel: 'últimos 7 dias' }
  if (range === '30d') return { range, since: new Date(Date.now() - 30 * 86_400_000).toISOString(), until: nowIso, periodLabel: 'últimos 30 dias' }
  return { range: 'mes', since: `${spToday.slice(0, 7)}-01T00:00:00-03:00`, until: nowIso, periodLabel: 'mês atual' }
}

export function PeriodFilter({ range, from, to, periodLabel, presets, note }: { range: string; from?: string; to?: string; periodLabel: string; presets?: [string, string][]; note?: string }) {
  const items: [string, string][] = presets ?? [['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Mês atual']]
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 99, fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
    border: active ? '1px solid var(--o)' : '1px solid rgba(0,0,0,.12)',
    background: active ? 'var(--o)' : '#fff', color: active ? '#fff' : 'var(--ink)', whiteSpace: 'nowrap', display: 'inline-block',
  })
  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,.14)', fontSize: 13.5, background: '#fff', color: 'var(--ink)' }
  return (
    <div className="rounded-2xl p-4 mb-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
      <div className="flex flex-wrap items-center gap-2">
        {items.map(([k, label]) => <a key={k} href={`?range=${k}`} style={pill(range === k)}>{label}</a>)}
        <form method="get" className="flex flex-wrap items-center gap-2" style={{ marginLeft: 'auto' }}>
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" defaultValue={from} aria-label="De" style={inp} />
          <span style={{ color: 'var(--mute)', fontSize: 13 }}>até</span>
          <input type="date" name="to" defaultValue={to} aria-label="Até" style={inp} />
          <button type="submit" style={{ ...pill(range === 'custom'), cursor: 'pointer', border: range === 'custom' ? '1px solid var(--g)' : '1px solid rgba(0,0,0,.12)', background: range === 'custom' ? 'var(--g)' : 'var(--ink)', color: '#fff' }}>Aplicar</button>
        </form>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 10 }}>Mostrando <strong style={{ color: 'var(--ink)' }}>{periodLabel}</strong>{note}</div>
    </div>
  )
}
