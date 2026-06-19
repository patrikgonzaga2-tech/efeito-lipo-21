-- ════════════════════════════════════════════════════════════════════
-- Colunas de funil na meta_insights + função funil_resumo (aba Funil).
-- Cole no Supabase → SQL Editor → Run. Seguro rodar de novo.
-- ════════════════════════════════════════════════════════════════════

-- Métricas de funil que o robô meta-insights passou a gravar (via actions do Meta).
alter table public.meta_insights
  add column if not exists link_clicks    bigint,   -- cliques no link (inline_link_clicks)
  add column if not exists lp_views       bigint,   -- landing_page_view
  add column if not exists ic             bigint,   -- initiate_checkout
  add column if not exists purchases      bigint,   -- purchase (pixel)
  add column if not exists purchase_value numeric;  -- valor das compras (pixel)

-- Resumo macro do funil num período: soma o Meta (completo) + vendas reais
-- da Hotmart (dedup por transação). Usada pela aba Funil do dashboard.
create or replace function public.funil_resumo(p_since timestamptz, p_until timestamptz)
returns table (
  spend numeric, impressions bigint, link_clicks bigint, lp_views bigint, ic bigint,
  purchases_meta bigint, value_meta numeric, vendas_real bigint, receita_real numeric
)
language sql stable as $fn$
  with m as (
    select coalesce(sum(spend),0) spend, coalesce(sum(impressions),0) impressions,
           coalesce(sum(link_clicks),0) link_clicks, coalesce(sum(lp_views),0) lp_views,
           coalesce(sum(ic),0) ic, coalesce(sum(purchases),0) purchases_meta,
           coalesce(sum(purchase_value),0) value_meta
    from public.meta_insights
    where date >= (p_since at time zone 'America/Sao_Paulo')::date
      and date <= (p_until at time zone 'America/Sao_Paulo')::date
  ),
  v as (
    select count(*) vendas_real, coalesce(sum(price),0) receita_real
    from (
      select distinct on (transaction) transaction, price
      from public.vendas
      where event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')
        and received_at >= p_since and received_at <= p_until
      order by transaction, received_at desc
    ) d
  )
  select m.spend, m.impressions, m.link_clicks, m.lp_views, m.ic,
         m.purchases_meta, m.value_meta, v.vendas_real, v.receita_real
  from m, v
$fn$;
