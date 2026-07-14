-- ════════════════════════════════════════════════════════════════════
-- AUDITORIA — Fase 2/3: funil_resumo (abas Geral e Funil do quiz)
--
-- Quatro correções, todas medidas contra os dados reais:
--
-- 1) VENDAS/RECEITA AGORA DESCONTAM REEMBOLSO. A tela sempre prometeu isso no
--    rodapé ("as vendas líquidas já descontam os reembolsos") e nunca fez: uma
--    compra devolvida seguia somando para sempre. Eram R$ 1.187,60 em julho.
--
-- 2) REEMBOLSO DATADO PELO DIA DA DEVOLUÇÃO, não pelo dia da compra. Antes, um
--    reembolso pedido em julho de uma compra de junho não aparecia em julho —
--    o painel subcontava o dinheiro que saiu do caixa (42 vs 60 reais).
--
-- 3) A COMUNIDADE SAI DO FUNIL DO EFEITO LIPO. O recorte deixava passar TODA a
--    Hotmart ("é 100% Efeito Lipo" — não é): entravam R$ 938 de vendas que não
--    são do quiz, incluindo R$ 355 da própria Comunidade, exatamente a receita
--    que a tela promete deixar de fora. Agora o corte é por FAMÍLIA.
--
-- 4) 'PURCHASE_WAITING_PAYMENT' e 'PURCHASE_PROTEST' entram no vocabulário
--    (aplicado antes, mantido aqui para o arquivo ficar auto-suficiente):
--    o PIX pendente da Greenn e o chargeback da Hotmart eram invisíveis.
--
-- NOTA sobre ABANDONO: continua sendo só da Hotmart — a Greenn não manda esse
-- evento. O card fica rotulado como tal no front. O equivalente na Greenn é o
-- "aguardando pagamento" (PIX gerado e não pago), que agora aparece.
-- ════════════════════════════════════════════════════════════════════

drop function if exists public.funil_resumo(timestamptz, timestamptz, boolean, text, text);
create or replace function public.funil_resumo(
  p_since timestamptz, p_until timestamptz,
  p_only_ads boolean default false,
  p_gateway text default null,
  p_greenn_sck text default null
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
  -- Uma linha por compra. Lemos de vendas_norm (e não de vendas) para ter a
  -- FAMÍLIA do produto — é ela que separa o Efeito Lipo da Comunidade.
  -- refunded_at = quando a devolução aconteceu (antes o reembolso era datado
  -- pela entrada da compra, e sumia do mês em que o dinheiro saiu).
  tx0 as (
    select transaction,
           (array_agg(event order by received_at desc))[1]              as last_event,
           min(received_at)                                             as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED')  as approved_at,
           max(received_at) filter (where event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')) as refunded_at,
           max(price)                                                   as price,
           max(producer_value)                                          as producer_value,
           max(buyer_email)                                             as buyer_email,
           max(gateway)                                                 as gateway,
           max(familia)                                                 as familia,
           max(tracking_src) filter (where tracking_src is not null and tracking_src <> '') as src,
           max(tracking_sck) filter (where tracking_sck is not null and tracking_sck <> '') as sck
    from public.vendas_norm
    where transaction is not null
      and (p_gateway is null or gateway = p_gateway)
    group by transaction
  ),
  -- Herança de src E de sck: se a transação não tem o marcador próprio, herda o
  -- da compra do mesmo comprador mais próxima no tempo (±30 min) que tenha — é o
  -- bump do mesmo clique de compra.
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
           )) as eff_src,
           coalesce(t.sck, (
             select t2.sck from tx0 t2
             where t2.buyer_email is not null
               and t2.buyer_email = t.buyer_email
               and t2.sck is not null
               and abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) <= 1800
             order by abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) asc
             limit 1
           )) as eff_sck
    from tx0 t
  ),
  -- Filtros: (1) só anúncio, quando pedido; (2) a Greenn só entra pelo funil do
  -- sck pedido; (3) a COMUNIDADE fica de fora — é assinatura, tem ticket 10x
  -- maior e vive no /painel. Isto vale para os DOIS gateways (antes a Hotmart
  -- "passava inteira" e trazia a Comunidade junto).
  txf as (
    select * from tx
    where (not p_only_ads or (eff_src is not null and eff_src <> ''))
      and (p_greenn_sck is null or gateway <> 'greenn' or coalesce(eff_sck,'') = p_greenn_sck)
      and coalesce(familia,'') <> 'Comunidade'
  ),
  -- Uma compra devolvida não é mais venda: `viva` é o que sobrou de pé.
  viva as (
    select * from txf
    where last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
  ),
  v as (
    select
      (select count(distinct (coalesce(buyer_email, transaction), approved_at::date))
         from viva where approved_at is not null and approved_at >= p_since and approved_at <= p_until)      as vendas_real,
      (select count(*) from viva
         where approved_at is not null and approved_at >= p_since and approved_at <= p_until)                as itens_vendidos,
      (select coalesce(sum(price),0) from viva
         where approved_at is not null and approved_at >= p_since and approved_at <= p_until)                as receita_real,
      (select coalesce(sum(producer_value),0) from viva
         where approved_at is not null and approved_at >= p_since and approved_at <= p_until)                as liquido_real,
      -- Reembolso ancorado na DATA DA DEVOLUÇÃO.
      (select count(*) from txf
         where refunded_at is not null and refunded_at >= p_since and refunded_at <= p_until
           and last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST'))                 as reembolsos_qtd,
      (select coalesce(sum(price),0) from txf
         where refunded_at is not null and refunded_at >= p_since and refunded_at <= p_until
           and last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST'))                 as reembolsos_valor,
      -- Aguardando: PIX/boleto gerado e não pago. WAITING_PAYMENT é o nome da
      -- Greenn — sem ele, o card enxergava zero no funil que hoje é 100% Greenn.
      (select count(*) from txf
         where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED','PURCHASE_WAITING_PAYMENT')
           and entry_anchor >= p_since and entry_anchor <= p_until)                                          as aguardando_qtd,
      (select coalesce(sum(price),0) from txf
         where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED','PURCHASE_WAITING_PAYMENT')
           and entry_anchor >= p_since and entry_anchor <= p_until)                                          as aguardando_valor
  ),
  -- Abandono de carrinho: SÓ a Hotmart manda esse evento. Com o quiz 100% Greenn
  -- este número tende a zero — o card está rotulado como "só Hotmart" no front.
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
