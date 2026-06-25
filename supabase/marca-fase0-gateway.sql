-- ════════════════════════════════════════════════════════════════════
-- MARCA · Fase 0 — Funções cientes de GATEWAY
-- Cole no Supabase → SQL Editor → Run. Seguro rodar de novo.
--
-- Por quê: agora a tabela `vendas` tem Hotmart E Greenn. As funções existentes
-- liam TUDO sem distinguir — então a aba "Geral" do Efeito Lipo passaria a
-- misturar a Comunidade (Greenn) nos rótulos "Hotmart" e a distorcer o ROAS
-- blended (gasto do Meta ÷ vendas que incluiriam orgânico/comercial da Greenn).
--
-- Solução desta fase: um parâmetro OPCIONAL p_gateway. Quando null = todas as
-- origens (o futuro painel da Marca usará assim). Quando 'hotmart' = só Hotmart
-- (as páginas atuais do Efeito Lipo passam a pedir isso, mantendo o sentido
-- delas). Nada visual muda ainda; é blindagem.
-- ════════════════════════════════════════════════════════════════════

-- ── funil_resumo: ganha p_gateway (mantém p_only_ads) ──
drop function if exists public.funil_resumo(timestamptz, timestamptz);
drop function if exists public.funil_resumo(timestamptz, timestamptz, boolean);
drop function if exists public.funil_resumo(timestamptz, timestamptz, text);
drop function if exists public.funil_resumo(timestamptz, timestamptz, boolean, text);
create or replace function public.funil_resumo(
  p_since timestamptz, p_until timestamptz,
  p_only_ads boolean default false,
  p_gateway text default null
)
returns table (
  spend numeric, impressions bigint, link_clicks bigint, lp_views bigint, ic bigint,
  purchases_meta bigint, value_meta numeric,
  vendas_real bigint, itens_vendidos bigint, receita_real numeric, liquido_real numeric,
  reembolsos_qtd bigint, reembolsos_valor numeric,
  aguardando_qtd bigint, aguardando_valor numeric,
  abandono_qtd bigint
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
  tx0 as (
    select transaction,
           (array_agg(event order by received_at desc))[1]              as last_event,
           min(received_at)                                             as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED')  as approved_at,
           max(price)                                                   as price,
           max(producer_value)                                         as producer_value,
           max(buyer_email)                                            as buyer_email,
           max(tracking_src) filter (where tracking_src is not null and tracking_src <> '') as src
    from public.vendas
    where transaction is not null
      and (p_gateway is null or gateway = p_gateway)
    group by transaction
  ),
  tx as (
    select t.*,
           coalesce(t.src, (
             select t2.src from tx0 t2
             where t2.buyer_email is not null
               and t2.buyer_email = t.buyer_email
               and t2.src is not null
               and abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) <= 1800
             order by abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) asc
             limit 1
           )) as eff_src
    from tx0 t
  ),
  txf as (
    select * from tx
    where (not p_only_ads or (eff_src is not null and eff_src <> ''))
  ),
  v as (
    select
      count(distinct (coalesce(buyer_email, transaction), approved_at::date))
        filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)         as vendas_real,
      count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)   as itens_vendidos,
      coalesce(sum(price) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)          as receita_real,
      coalesce(sum(producer_value) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0) as liquido_real,
      count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until)                  as reembolsos_qtd,
      coalesce(sum(price) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until),0)     as reembolsos_valor,
      count(*) filter (where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED') and entry_anchor >= p_since and entry_anchor <= p_until)               as aguardando_qtd,
      coalesce(sum(price) filter (where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED') and entry_anchor >= p_since and entry_anchor <= p_until),0) as aguardando_valor
    from txf
  ),
  a as (
    select count(distinct buyer_email) as abandono_qtd
    from public.vendas
    where event = 'PURCHASE_OUT_OF_SHOPPING_CART'
      and received_at >= p_since and received_at <= p_until
      and (p_gateway is null or gateway = p_gateway)
  )
  select m.spend, m.impressions, m.link_clicks, m.lp_views, m.ic,
         m.purchases_meta, m.value_meta,
         v.vendas_real, v.itens_vendidos, v.receita_real, v.liquido_real,
         v.reembolsos_qtd, v.reembolsos_valor,
         v.aguardando_qtd, v.aguardando_valor, a.abandono_qtd
  from m, v, a
$fn$;

-- ── vendas_por_produto: ganha p_gateway ──
drop function if exists public.vendas_por_produto(timestamptz, timestamptz);
drop function if exists public.vendas_por_produto(timestamptz, timestamptz, text);
create or replace function public.vendas_por_produto(
  p_since timestamptz, p_until timestamptz, p_gateway text default null
)
returns table (
  product_name text,
  vendas bigint, receita numeric, liquido numeric,
  reembolsos bigint, reembolsos_valor numeric
)
language sql stable as $fn$
  with tx as (
    select transaction,
           (array_agg(product_name order by received_at desc))[1]      as product_name,
           (array_agg(event        order by received_at desc))[1]      as last_event,
           min(received_at)                                            as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           max(price)                                                  as price,
           max(producer_value)                                         as producer_value
    from public.vendas
    where transaction is not null
      and (p_gateway is null or gateway = p_gateway)
    group by transaction
  )
  select
    product_name,
    count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)                          as vendas,
    coalesce(sum(price) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)            as receita,
    coalesce(sum(producer_value) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)   as liquido,
    count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until)               as reembolsos,
    coalesce(sum(price) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until),0) as reembolsos_valor
  from tx
  group by product_name
  having
    count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until) > 0
    or count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until) > 0
  order by vendas desc
$fn$;
