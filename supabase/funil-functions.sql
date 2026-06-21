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
-- da Hotmart. Usada pela aba Funil do dashboard.
--
-- VENDAS LÍQUIDAS (reflete a realidade): a tabela `vendas` é um log de eventos;
-- uma mesma compra (transaction) passa por vários estados (boleto gerado →
-- aprovada → reembolsada…). Aqui reduzimos cada transação ao seu ESTADO ATUAL
-- (o evento mais recente) e só contamos como venda quem está APPROVED/COMPLETE
-- AGORA. Quem foi reembolsada/cancelada/chargeback sai do número sozinha.
--
-- Também devolvemos os "baldes de dinheiro na mesa":
--   • reembolsos  = compras pagas e devolvidas (REFUNDED/CHARGEBACK)
--   • aguardando  = boleto/Pix gerado e ainda não pago (BILLET_PRINTED/DELAYED)
--   • abandono    = carrinho abandonado (OUT_OF_SHOPPING_CART) — só quantidade,
--                   a Hotmart não manda valor nesse evento.
-- Período: cada transação é ancorada em quando ENTROU (1º aviso recebido).
--
-- p_only_ads (opcional): quando true, conta SÓ as vendas que vieram de anúncio
-- (têm tracking_src = id do anúncio). É o que separa a aba "Funil" (só ad-driven;
-- exclui orgânico/sem-rastreio/WhatsApp) da aba "Geral" (todas as origens). O
-- gasto/funil do Meta não muda — é sempre o investimento que alimenta o funil.
drop function if exists public.funil_resumo(timestamptz, timestamptz);
drop function if exists public.funil_resumo(timestamptz, timestamptz, text);
drop function if exists public.funil_resumo(timestamptz, timestamptz, boolean);
create or replace function public.funil_resumo(p_since timestamptz, p_until timestamptz, p_only_ads boolean default false)
returns table (
  spend numeric, impressions bigint, link_clicks bigint, lp_views bigint, ic bigint,
  purchases_meta bigint, value_meta numeric,
  vendas_real bigint, receita_real numeric, liquido_real numeric,
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
  -- Uma linha por compra, com o estado atual, a âncora de período e o valor.
  tx as (
    select transaction,
           (array_agg(event order by received_at desc))[1] as last_event,
           min(received_at)                                 as anchor,
           max(price)                                       as price,
           max(producer_value)                              as producer_value
    from public.vendas
    where transaction is not null
      and (not p_only_ads or (tracking_src is not null and tracking_src <> ''))
    group by transaction
  ),
  v as (
    select
      count(*) filter (where last_event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE'))                       as vendas_real,
      coalesce(sum(price) filter (where last_event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')),0)         as receita_real,
      coalesce(sum(producer_value) filter (where last_event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')),0) as liquido_real,
      count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK'))                     as reembolsos_qtd,
      coalesce(sum(price) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')),0)       as reembolsos_valor,
      count(*) filter (where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED'))                  as aguardando_qtd,
      coalesce(sum(price) filter (where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED')),0)    as aguardando_valor
    from tx
    where anchor >= p_since and anchor <= p_until
  ),
  -- Abandono de carrinho NÃO tem código de transação (a Hotmart manda só
  -- comprador + produto, sem valor). Por isso conta-se à parte, por comprador
  -- distinto, ancorado em quando o aviso chegou.
  a as (
    select count(distinct buyer_email) as abandono_qtd
    from public.vendas
    where event = 'PURCHASE_OUT_OF_SHOPPING_CART'
      and received_at >= p_since and received_at <= p_until
  )
  select m.spend, m.impressions, m.link_clicks, m.lp_views, m.ic,
         m.purchases_meta, m.value_meta,
         v.vendas_real, v.receita_real, v.liquido_real,
         v.reembolsos_qtd, v.reembolsos_valor,
         v.aguardando_qtd, v.aguardando_valor, a.abandono_qtd
  from m, v, a
$fn$;
