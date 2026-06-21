'use client'

import { useState, useMemo } from 'react'
import { SortableTable, type Row } from '../_sortable'

export type RealAdRow = {
  nome: string; conjunto: string; adset_id: string; campaignId?: string
  vendas: number; itens: number; receita: number; spend: number; cpa: number | null; roas: number | null
}

const N = (v: unknown) => Number(v) || 0
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const intBR = (n: number) => Math.round(n).toLocaleString('pt-BR')

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>{title}</h2>
      {note && <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 10 }}>{note}</p>}
      <div style={{ marginTop: note ? 0 : 10 }}>{children}</div>
    </section>
  )
}

export default function AnunciosExplorer({ campRows, conjRows, adRows, anuncioRows }: {
  campRows: Row[]; conjRows: Row[]; adRows: Row[]; anuncioRows: RealAdRow[]
}) {
  // Filtro hierárquico: campanha → conjunto → anúncio.
  const [camp, setCamp] = useState<string | null>(null)
  const [conj, setConj] = useState<string | null>(null)

  const campName = useMemo(() => new Map(campRows.map((r) => [r.id, r.lead[0] || r.id])), [campRows])
  const conjName = useMemo(() => new Map(conjRows.map((r) => [r.id, r.lead[0] || r.id])), [conjRows])

  // Clicar na campanha: liga/desliga; ao trocar de campanha, limpa o conjunto.
  const pickCamp = (id: string) => { setConj(null); setCamp((c) => (c === id ? null : id)) }
  // Clicar no conjunto: liga/desliga; ao ligar, fixa também a campanha dele.
  const pickConj = (id: string) => {
    if (conj === id) { setConj(null); return }
    setConj(id)
    const cid = conjRows.find((r) => r.id === id)?.campaignId ?? null
    if (cid) setCamp(cid)
  }
  const clear = () => { setCamp(null); setConj(null) }

  const conjShown = useMemo(() => (camp ? conjRows.filter((r) => r.campaignId === camp) : conjRows), [conjRows, camp])
  const adShown = useMemo(() => adRows.filter((r) => (!conj || r.adsetId === conj) && (!camp || r.campaignId === camp)), [adRows, camp, conj])
  const realShown = useMemo(() => anuncioRows.filter((r) => (!conj || r.adset_id === conj) && (!camp || r.campaignId === camp)), [anuncioRows, camp, conj])

  const active = camp || conj
  const chip = (label: string, onX: () => void) => (
    <button onClick={onX} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--o)', background: '#fff', border: '1px solid rgba(245,113,0,.35)', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>{label} ✕</button>
  )

  return (
    <>
      {active && (
        <div className="rounded-xl p-3 mt-4 flex flex-wrap items-center" style={{ gap: 8, background: 'rgba(245,113,0,.07)', border: '1px solid rgba(245,113,0,.18)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Filtro:</span>
          {camp && chip(`Campanha: ${campName.get(camp) ?? camp}`, () => clear())}
          {conj && chip(`Conjunto: ${conjName.get(conj) ?? conj}`, () => setConj(null))}
          <button onClick={clear} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--sub)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>limpar tudo</button>
        </div>
      )}

      <Section title="Campanhas" note="Clique numa campanha para filtrar conjuntos e anúncios · clique numa coluna para ordenar">
        <SortableTable leadHead={['Campanha']} rows={campRows} hasStatus defaultSort="roas_real" onPick={pickCamp} selectedId={camp} />
      </Section>
      <Section title="Conjuntos" note="Clique num conjunto para filtrar os anúncios · clique numa coluna para ordenar">
        <SortableTable leadHead={['Conjunto', 'Campanha']} rows={conjShown} hasStatus defaultSort="roas_real" onPick={pickConj} selectedId={conj} />
      </Section>
      <Section title="Anúncios (pixel)" note="Métricas do pixel do Meta por anúncio · padrão: compras do pixel">
        <SortableTable leadHead={['Anúncio', 'Conjunto']} rows={adShown} showRank hasStatus defaultSort="purchases" />
      </Section>

      <Section title="Vendas reais por anúncio" note="Vendas da Hotmart ligadas ao anúncio pelo xcod (nome do criativo). Só vale pra vendas após a ponte entrar no ar; o investido/CPA/ROAS real só aparece quando o nome do criativo casa com o do Meta.">
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              {['Anúncio', 'Conjunto', 'Vendas', 'Produtos', 'Receita', 'Investido', 'CPA real', 'ROAS real'].map((h, i) => (
                <th key={h} style={{ padding: '9px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)', textAlign: i < 2 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {realShown.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', fontSize: 13 }}>Sem vendas reais atribuídas a anúncio no filtro/período (a ponte vale a partir do deploy).</td></tr>}
              {realShown.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                  <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.conjunto}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right' }}>{intBR(N(r.vendas))}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', color: 'var(--sub)' }}>{intBR(N(r.itens))}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', fontWeight: 700 }}>{brl0(N(r.receita))}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', color: 'var(--sub)' }}>{r.spend > 0 ? brl0(r.spend) : '—'}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', color: 'var(--sub)' }}>{r.cpa == null ? '—' : brl0(r.cpa)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', fontWeight: 800, color: r.roas == null ? 'var(--mute)' : r.roas >= 1 ? 'var(--g)' : '#c0392b' }}>{r.roas == null ? '—' : r.roas.toFixed(2) + 'x'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
