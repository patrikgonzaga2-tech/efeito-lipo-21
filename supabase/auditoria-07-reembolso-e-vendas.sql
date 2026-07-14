-- ════════════════════════════════════════════════════════════════════
-- AUDITORIA — Fase 7: o painel contava dinheiro devolvido como receita
--
-- Conferência de julho/2026, Greenn:  painel 866 vendas / R$57.605 líquido
--                                     Greenn 1.024 vendas / R$53.308 líquido
--                                     banco  1.024 vendas / R$53.782 líquido
-- O banco estava certo. Quem errava era a SOMA. Quatro defeitos:
--
--   1) RECEITA E LÍQUIDO INCLUÍAM COMPRA DEVOLVIDA. As funções somavam tudo que
--      foi aprovado no período, sem tirar o que foi reembolsado depois —
--      R$3.823 de dinheiro que voltou pra cliente contados como faturamento.
--      Contaminava Visão Geral, Produtos, Canais, Gateways, teste A/B e o ROAS
--      (numerador inflado, gasto real → ROAS mentiroso).
--
--   2) REEMBOLSO DATADO PELA COMPRA, não pela devolução (entry_anchor). Um
--      reembolso feito em julho de uma compra de junho sumia de julho. Agora
--      ancora em refunded_at, como já faziam o Funil e o Upsell.
--
--   3) COMPRA DE TESTE contava em tudo. A tabela emails_teste (criada na
--      auditoria 06) só valia no Upsell — agora vale no painel inteiro.
--
--   4) "VENDAS" = comprador único por dia, não venda. Mantido por decisão do
--      Vinicius (é o carrinho: bump não vira venda separada), mas o rótulo no
--      front passa a ser COMPRAS, com os ITENS ao lado — que é o número que se
--      compara com a Greenn (1.024).
--
-- A regra de "venda viva" vivia repetida (e divergente) em 12 funções. Agora
-- mora num lugar só: a view compras_aprovadas, que ganhou refunded_at, teste e
-- viva. Toda função de dinheiro lê dela.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1) compras_aprovadas — uma linha por COMPRA (transação), com o estado atual.
--    Colunas antigas mantidas na mesma ordem (funções dependem delas); as novas
--    entram no fim.
--      viva        = não foi devolvida (é o que conta como venda/receita)
--      teste       = compra interna (emails_teste) — nunca é venda
--      refunded_at = quando o dinheiro VOLTOU (data honesta do reembolso)
-- ─────────────────────────────────────────────────────────────────────
create or replace view public.compras_aprovadas as
  with g as (
    select
      v.transaction,
      max(v.email_norm)                                            as email_norm,
      max(v.buyer_name)                                            as buyer_name,
      (array_agg(v.gateway order by v.received_at desc))[1]        as gateway,
      (array_agg(v.familia order by v.received_at desc))[1]        as familia,
      (array_agg(v.produto order by v.received_at desc))[1]        as produto,
      (array_agg(v.tipo    order by v.received_at desc))[1]        as tipo,
      (array_agg(v.event   order by v.received_at desc))[1]        as last_event,
      min(v.received_at) filter (where v.event = 'PURCHASE_APPROVED') as approved_at,
      max(v.price)                                                 as price,
      max(v.producer_value)                                        as liquido,
      (array_agg(v.product_name order by v.received_at desc))[1]   as product_name,
      (array_agg(v.canal        order by v.received_at desc))[1]   as canal,
      min(v.received_at)                                           as entry_anchor,
      max(v.received_at) filter (
        where v.event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
      )                                                            as refunded_at,
      max(v.tracking_src)  filter (where v.tracking_src  is not null and v.tracking_src  <> '') as src,
      max(v.tracking_sck)  filter (where v.tracking_sck  is not null and v.tracking_sck  <> '') as sck,
      max(v.tracking_xcod) filter (where v.tracking_xcod is not null and v.tracking_xcod <> '') as xcod
    from public.vendas_norm v
    where v.transaction is not null
    group by v.transaction
  )
  -- Ordem das colunas antigas preservada (create or replace view exige) — as
  -- novas entram no fim.
  select
    g.transaction, g.email_norm, g.buyer_name, g.gateway, g.familia, g.produto,
    g.tipo, g.last_event, g.approved_at, g.price, g.liquido,
    g.product_name, g.canal, g.entry_anchor, g.refunded_at,
    g.last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST') as viva,
    exists (select 1 from public.emails_teste e where e.email = g.email_norm)          as teste,
    g.src, g.sck, g.xcod
  from g;

-- ─────────────────────────────────────────────────────────────────────
-- 2) Visão Geral (/painel) — por gateway.
--    vendas = COMPRAS (comprador+dia: o carrinho, bump não conta separado)
--    itens  = transações — é este que bate com o relatório da Greenn
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.marca_resumo(p_since timestamptz, p_until timestamptz)
returns table(gateway text, vendas bigint, itens bigint, receita numeric, liquido numeric, reembolsos bigint, reembolsos_valor numeric)
language sql stable as $fn$
  with vend as (
    select c.gateway,
           count(distinct (coalesce(c.email_norm, c.transaction), c.approved_at::date)) as vendas,
           count(*)                          as itens,
           coalesce(sum(c.price),0)          as receita,
           coalesce(sum(c.liquido),0)        as liquido
    from public.compras_aprovadas c
    where c.viva and not c.teste
      and c.approved_at is not null and c.approved_at between p_since and p_until
    group by c.gateway
  ),
  reemb as (
    select c.gateway, count(*) as reembolsos, coalesce(sum(c.price),0) as reembolsos_valor
    from public.compras_aprovadas c
    where not c.viva and not c.teste
      and c.refunded_at is not null and c.refunded_at between p_since and p_until
    group by c.gateway
  )
  select coalesce(v.gateway, r.gateway),
         coalesce(v.vendas,0), coalesce(v.itens,0),
         coalesce(v.receita,0), coalesce(v.liquido,0),
         coalesce(r.reembolsos,0), coalesce(r.reembolsos_valor,0)
  from vend v full join reemb r on r.gateway = v.gateway
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 3) Visão Geral — por produto e por canal
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.marca_por_produto(p_since timestamptz, p_until timestamptz)
returns table(produto text, familia text, tipo text, gateway text, vendas bigint, receita numeric, liquido numeric, reembolsos bigint)
language sql stable as $fn$
  with vend as (
    select c.produto, c.familia, c.tipo, c.gateway,
           count(*)                   as vendas,
           coalesce(sum(c.price),0)   as receita,
           coalesce(sum(c.liquido),0) as liquido
    from public.compras_aprovadas c
    where c.viva and not c.teste
      and c.approved_at is not null and c.approved_at between p_since and p_until
    group by 1,2,3,4
  ),
  reemb as (
    select c.produto, c.familia, c.tipo, c.gateway, count(*) as reembolsos
    from public.compras_aprovadas c
    where not c.viva and not c.teste
      and c.refunded_at is not null and c.refunded_at between p_since and p_until
    group by 1,2,3,4
  )
  select coalesce(v.produto, r.produto), coalesce(v.familia, r.familia),
         coalesce(v.tipo, r.tipo), coalesce(v.gateway, r.gateway),
         coalesce(v.vendas,0), coalesce(v.receita,0), coalesce(v.liquido,0),
         coalesce(r.reembolsos,0)
  from vend v
  full join reemb r
    on r.produto = v.produto and r.familia = v.familia
   and r.tipo = v.tipo and r.gateway = v.gateway
  order by 6 desc
$fn$;

create or replace function public.marca_por_canal(p_since timestamptz, p_until timestamptz)
returns table(canal text, vendas bigint, itens bigint, receita numeric, liquido numeric)
language sql stable as $fn$
  select c.canal,
         count(distinct (coalesce(c.email_norm, c.transaction), c.approved_at::date)) as vendas,
         count(*)                   as itens,
         coalesce(sum(c.price),0)   as receita,
         coalesce(sum(c.liquido),0) as liquido
  from public.compras_aprovadas c
  where c.viva and not c.teste
    and c.approved_at is not null and c.approved_at between p_since and p_until
  group by c.canal
  order by 4 desc
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 4) Produtos (dashboard do quiz) — por nome do produto no gateway
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.vendas_por_produto(p_since timestamptz, p_until timestamptz, p_gateway text default null)
returns table(product_name text, vendas bigint, receita numeric, liquido numeric, reembolsos bigint, reembolsos_valor numeric)
language sql stable as $fn$
  with base as (
    select * from public.compras_aprovadas c
    where not c.teste and (p_gateway is null or c.gateway = p_gateway)
  ),
  vend as (
    select b.product_name, count(*) as vendas,
           coalesce(sum(b.price),0) as receita, coalesce(sum(b.liquido),0) as liquido
    from base b
    where b.viva and b.approved_at is not null and b.approved_at between p_since and p_until
    group by 1
  ),
  reemb as (
    select b.product_name, count(*) as reembolsos, coalesce(sum(b.price),0) as reembolsos_valor
    from base b
    where not b.viva and b.refunded_at is not null and b.refunded_at between p_since and p_until
    group by 1
  )
  select coalesce(v.product_name, r.product_name),
         coalesce(v.vendas,0), coalesce(v.receita,0), coalesce(v.liquido,0),
         coalesce(r.reembolsos,0), coalesce(r.reembolsos_valor,0)
  from vend v full join reemb r on r.product_name = v.product_name
  order by 2 desc
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 5) Gateways e teste A/B de checkout (só o funil do quiz: sck efeito-lipo-quiz)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.quiz_produto_gateway(p_since timestamptz, p_until timestamptz)
returns table(gateway text, product_name text, vendas bigint, receita numeric, liquido numeric, reembolsos bigint, reembolsos_valor numeric)
language sql stable as $fn$
  with base as (
    select * from public.compras_aprovadas c
    where not c.teste and coalesce(c.sck,'') = 'efeito-lipo-quiz'
  ),
  vend as (
    select b.gateway, coalesce(b.product_name,'sem-nome') as product_name, count(*) as vendas,
           coalesce(sum(b.price),0) as receita, coalesce(sum(b.liquido),0) as liquido
    from base b
    where b.viva and b.approved_at is not null and b.approved_at between p_since and p_until
    group by 1,2
  ),
  reemb as (
    select b.gateway, coalesce(b.product_name,'sem-nome') as product_name,
           count(*) as reembolsos, coalesce(sum(b.price),0) as reembolsos_valor
    from base b
    where not b.viva and b.refunded_at is not null and b.refunded_at between p_since and p_until
    group by 1,2
  )
  select coalesce(v.gateway, r.gateway), coalesce(v.product_name, r.product_name),
         coalesce(v.vendas,0), coalesce(v.receita,0), coalesce(v.liquido,0),
         coalesce(r.reembolsos,0), coalesce(r.reembolsos_valor,0)
  from vend v full join reemb r on r.gateway = v.gateway and r.product_name = v.product_name
$fn$;

create or replace function public.quiz_checkout_ab(p_since timestamptz, p_until timestamptz)
returns table(gateway text, vendas bigint, itens bigint, receita numeric, liquido numeric, reembolsos bigint, reembolsos_valor numeric)
language sql stable as $fn$
  with base as (
    select * from public.compras_aprovadas c
    where not c.teste and coalesce(c.sck,'') = 'efeito-lipo-quiz'
  ),
  vend as (
    select b.gateway,
           count(distinct (coalesce(b.email_norm, b.transaction), b.approved_at::date)) as vendas,
           count(*) as itens,
           coalesce(sum(b.price),0) as receita, coalesce(sum(b.liquido),0) as liquido
    from base b
    where b.viva and b.approved_at is not null and b.approved_at between p_since and p_until
    group by 1
  ),
  reemb as (
    select b.gateway, count(*) as reembolsos, coalesce(sum(b.price),0) as reembolsos_valor
    from base b
    where not b.viva and b.refunded_at is not null and b.refunded_at between p_since and p_until
    group by 1
  )
  select coalesce(v.gateway, r.gateway),
         coalesce(v.vendas,0), coalesce(v.itens,0), coalesce(v.receita,0), coalesce(v.liquido,0),
         coalesce(r.reembolsos,0), coalesce(r.reembolsos_valor,0)
  from vend v full join reemb r on r.gateway = v.gateway
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 6) ROAS por conjunto — o pior lugar pra contar dinheiro devolvido: o gasto do
--    anúncio é real, então receita inflada = ROAS mentiroso.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.roi_conjuntos(p_since timestamptz, p_until timestamptz)
returns table(adset_id text, adset_name text, campaign_id text, campaign_name text, spend numeric, sessions bigint, checkouts bigint, vendas bigint, receita numeric)
language sql stable as $fn$
  with sp as (
    select ad_id as adset_id, max(adset_name) adset_name, max(campaign_id) campaign_id,
           max(campaign_name) campaign_name, sum(spend) spend
    from public.meta_insights
    where date >= (p_since at time zone 'America/Sao_Paulo')::date
      and date <= (p_until at time zone 'America/Sao_Paulo')::date
    group by ad_id
  ),
  q as (
    select utm_term adset_id, count(*) sessions,
           count(*) filter (where checkout_clicked) checkouts
    from public.quiz_sessions
    where created_at >= p_since and created_at <= p_until
      and utm_term ~ '^[0-9]{6,}$'
    group by utm_term
  ),
  v as (
    select c.src as adset_id, count(*) as vendas, coalesce(sum(c.price),0) as receita
    from public.compras_aprovadas c
    where c.viva and not c.teste
      and c.approved_at is not null and c.approved_at between p_since and p_until
      and c.src ~ '^[0-9]{6,}$'
    group by c.src
  )
  select sp.adset_id, sp.adset_name, sp.campaign_id, sp.campaign_name,
         coalesce(sp.spend,0), coalesce(q.sessions,0), coalesce(q.checkouts,0),
         coalesce(v.vendas,0), coalesce(v.receita,0)
  from sp
  left join q on q.adset_id = sp.adset_id
  left join v on v.adset_id = sp.adset_id
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 7) As que já excluíam devolvida, mas contavam compra de teste
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.clientes_top(p_since timestamptz, p_until timestamptz, p_limit integer default 50)
returns table(nome text, email text, n_familias integer, familias text, pedidos bigint, ltv numeric, liquido numeric, primeira timestamptz, ultima timestamptz)
language sql stable as $fn$
  with cli as (
    select email_norm,
           max(buyer_name)             as nome,
           min(approved_at)            as primeira,
           max(approved_at)            as ultima,
           count(distinct transaction) as pedidos,
           array_agg(distinct familia) as familias_arr,
           sum(price)                  as ltv,
           sum(liquido)                as liquido
    from public.compras_aprovadas
    where approved_at is not null and email_norm is not null and viva and not teste
    group by email_norm
  )
  select nome, email_norm, cardinality(familias_arr), array_to_string(familias_arr, ', '),
         pedidos, ltv, liquido, primeira, ultima
  from cli
  where primeira >= p_since and primeira <= p_until
  order by ltv desc nulls last
  limit p_limit
$fn$;

create or replace function public.cross_sell_resumo(p_since timestamptz, p_until timestamptz)
returns table(clientes bigint, multi_familia bigint, clientes_el bigint, clientes_com bigint, el_e_com bigint, ltv_medio numeric, receita_total numeric, dias_el_para_com numeric)
language sql stable as $fn$
  with cli as (
    select email_norm,
           min(approved_at)                                        as primeira,
           array_agg(distinct familia)                             as familias,
           sum(price)                                              as receita,
           min(approved_at) filter (where familia = 'Efeito Lipo') as primeira_el,
           min(approved_at) filter (where familia = 'Comunidade')  as primeira_com
    from public.compras_aprovadas
    where approved_at is not null and email_norm is not null and viva and not teste
    group by email_norm
  ),
  coorte as (select * from cli where primeira >= p_since and primeira <= p_until)
  select
    count(*),
    count(*) filter (where cardinality(familias) > 1),
    count(*) filter (where 'Efeito Lipo' = any(familias)),
    count(*) filter (where 'Comunidade'  = any(familias)),
    count(*) filter (where 'Efeito Lipo' = any(familias) and 'Comunidade' = any(familias)),
    coalesce(round(avg(receita), 2), 0),
    coalesce(sum(receita), 0),
    coalesce(round(avg(extract(epoch from (primeira_com - primeira_el)) / 86400)
             filter (where primeira_el is not null and primeira_com is not null and primeira_com >= primeira_el), 1), null)
  from coorte
$fn$;

create or replace function public.cross_sell_matriz(p_since timestamptz, p_until timestamptz)
returns table(familia_a text, familia_b text, clientes_a bigint, clientes_ambos bigint)
language sql stable as $fn$
  with cli as (
    select email_norm, min(approved_at) as primeira, array_agg(distinct familia) as familias
    from public.compras_aprovadas
    where approved_at is not null and email_norm is not null and viva and not teste
    group by email_norm
  ),
  coorte as (select * from cli where primeira >= p_since and primeira <= p_until),
  fams as (select distinct unnest(familias) as familia from coorte)
  select fa.familia, fb.familia,
         count(*) filter (where fa.familia = any(c.familias)),
         count(*) filter (where fa.familia = any(c.familias) and fb.familia = any(c.familias))
  from fams fa cross join fams fb cross join coorte c
  group by fa.familia, fb.familia
$fn$;

create or replace function public.vendas_por_conjunto(p_since timestamptz, p_until timestamptz)
returns table(adset_id text, vendas bigint, itens bigint, receita numeric, liquido numeric)
language sql stable as $fn$
  -- Herança de src: bump do mesmo checkout não tem marcador próprio — herda o da
  -- compra do mesmo comprador a até 30 min de distância.
  -- `materialized`: a busca do irmão roda uma vez por linha; sem isso o Postgres
  -- refaz a view compras_aprovadas a cada uma delas e a consulta estoura o tempo.
  with c0 as materialized (select * from public.compras_aprovadas),
  tx as (
    select c.*,
           coalesce(c.src, (
             select c2.src from c0 c2
             where c2.email_norm is not null and c2.email_norm = c.email_norm
               and c2.src is not null
               and abs(extract(epoch from (c2.entry_anchor - c.entry_anchor))) <= 1800
             order by abs(extract(epoch from (c2.entry_anchor - c.entry_anchor))) asc
             limit 1
           )) as eff_src
    from c0 c
  )
  select eff_src,
         count(distinct (coalesce(email_norm, transaction), approved_at::date)),
         count(*), coalesce(sum(price),0), coalesce(sum(liquido),0)
  from tx
  where viva and not teste
    and approved_at is not null and approved_at between p_since and p_until
    and eff_src ~ '^[0-9]{6,}$'
  group by eff_src
$fn$;

create or replace function public.vendas_por_anuncio(p_since timestamptz, p_until timestamptz)
returns table(anuncio text, adset_id text, vendas bigint, itens bigint, receita numeric, liquido numeric)
language sql stable as $fn$
  -- Filtra o período ANTES de calcular a herança de src: a busca do irmão é uma
  -- varredura por linha, então rodá-la em todas as compras da base (e só depois
  -- jogar fora o que está fora do período) estourava o tempo limite.
  with c0 as materialized (select * from public.compras_aprovadas),
  alvo as (
    select * from c0
    where viva and not teste
      and approved_at is not null and approved_at between p_since and p_until
  ),
  tx as (
    select a.*,
           coalesce(a.src, (
             select c2.src from c0 c2
             where c2.email_norm is not null and c2.email_norm = a.email_norm
               and c2.src is not null
               and abs(extract(epoch from (c2.entry_anchor - a.entry_anchor))) <= 1800
             order by abs(extract(epoch from (c2.entry_anchor - a.entry_anchor))) asc
             limit 1
           )) as eff_src
    from alvo a
  ),
  -- `materialized`: sem isso o Postgres recalculava esta agregação (54 mil
  -- sessões) uma vez POR COMPRA — 1.264 vezes, 40s, estouro do tempo limite.
  sess as materialized (
    select xcod,
           mode() within group (order by utm_content) as anuncio,
           mode() within group (order by utm_term)    as adset_id
    from public.quiz_sessions
    where xcod is not null and xcod <> ''
    group by xcod
  )
  select coalesce(nullif(s.anuncio, ''), '(sem anúncio identificado)'),
         coalesce(s.adset_id, tx.eff_src),
         count(distinct (coalesce(tx.email_norm, tx.transaction), tx.approved_at::date)),
         count(*), coalesce(sum(tx.price),0), coalesce(sum(tx.liquido),0)
  from tx
  left join sess s on s.xcod = tx.xcod
  where tx.viva and not tx.teste
    and tx.approved_at is not null and tx.approved_at between p_since and p_until
    and tx.eff_src ~ '^[0-9]{6,}$'
  group by 1, 2
  order by 5 desc
$fn$;

create or replace function public.recorrencia_resumo(p_since timestamptz, p_until timestamptz)
returns table(assinantes bigint, cobrancas bigint, receita_coletada numeric, mrr_estimado numeric, arr_estimado numeric, cancelados bigint, pagantes_total bigint, expirados bigint)
language sql stable as $fn$
  with pagantes as (select distinct email from public.assinantes_norm),
  churn as (
    select count(distinct a.contract_id) as n
    from public.assinaturas a
    left join pagantes p on p.email = lower(trim(a.buyer_email))
    where a.status in ('canceled','cancelled')
      and a.product_name ilike '%comunidade%'
      and (a.old_status in ('paid','active') or p.email is not null)
      and a.received_at >= p_since and a.received_at <= p_until
  ),
  cob as (
    select * from public.compras_aprovadas c
    where c.familia = 'Comunidade' and c.viva and not c.teste
      and c.approved_at is not null and c.approved_at between p_since and p_until
  )
  select
    (select count(*) from public.assinantes_norm where status = 'ativo'),
    (select count(*) from cob),
    coalesce((select sum(price) from cob), 0),
    coalesce((select sum(mrr) from public.assinantes_norm where status = 'ativo'), 0),
    coalesce((select sum(mrr) from public.assinantes_norm where status = 'ativo'), 0) * 12,
    (select n from churn),
    (select count(*) from public.assinantes_norm),
    (select count(*) from public.assinantes_norm where status = 'expirado')
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 8) Funil e Origem (UTM) — já excluíam devolvida; faltava a compra de teste.
--    (funil_resumo mantém a lógica própria de herança de src/sck e de filtro
--    por gateway/sck; aqui só entra o anti-join de emails_teste.)
-- ─────────────────────────────────────────────────────────────────────
-- funil_resumo: mantém a lógica própria (herança de src/sck ±30min, filtro por
-- gateway/sck, Comunidade fora) — a única mudança é ignorar a compra de teste.
create or replace function public.funil_resumo(p_since timestamptz, p_until timestamptz, p_only_ads boolean default false, p_gateway text default null, p_greenn_sck text default null)
returns table(spend numeric, impressions bigint, link_clicks bigint, lp_views bigint, ic bigint, purchases_meta bigint, value_meta numeric, vendas_real bigint, itens_vendidos bigint, receita_real numeric, liquido_real numeric, reembolsos_qtd bigint, reembolsos_valor numeric, aguardando_qtd bigint, aguardando_valor numeric, abandono_qtd bigint)
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
  tx0 as materialized (
    select c.transaction, c.last_event, c.entry_anchor, c.approved_at, c.refunded_at,
           c.price, c.liquido as producer_value, c.email_norm as buyer_email,
           c.gateway, c.familia, c.viva, c.src, c.sck
    from public.compras_aprovadas c
    where not c.teste
      and (p_gateway is null or c.gateway = p_gateway)
  ),
  tx as (
    select t.*,
           coalesce(t.src, (
             select t2.src from tx0 t2
             where t2.buyer_email is not null and t2.buyer_email = t.buyer_email
               and t2.src is not null
               and abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) <= 1800
             order by abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) asc
             limit 1
           )) as eff_src,
           coalesce(t.sck, (
             select t2.sck from tx0 t2
             where t2.buyer_email is not null and t2.buyer_email = t.buyer_email
               and t2.sck is not null
               and abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) <= 1800
             order by abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) asc
             limit 1
           )) as eff_sck
    from tx0 t
  ),
  txf as (
    select * from tx
    where (not p_only_ads or (eff_src is not null and eff_src <> ''))
      and (p_greenn_sck is null or gateway <> 'greenn' or coalesce(eff_sck,'') = p_greenn_sck)
      and coalesce(familia,'') <> 'Comunidade'
  ),
  viva as (select * from txf where viva),
  v as (
    select
      (select count(distinct (coalesce(buyer_email, transaction), approved_at::date))
         from viva where approved_at is not null and approved_at between p_since and p_until)  as vendas_real,
      (select count(*) from viva
         where approved_at is not null and approved_at between p_since and p_until)            as itens_vendidos,
      (select coalesce(sum(price),0) from viva
         where approved_at is not null and approved_at between p_since and p_until)            as receita_real,
      (select coalesce(sum(producer_value),0) from viva
         where approved_at is not null and approved_at between p_since and p_until)            as liquido_real,
      (select count(*) from txf
         where not viva and refunded_at is not null and refunded_at between p_since and p_until)      as reembolsos_qtd,
      (select coalesce(sum(price),0) from txf
         where not viva and refunded_at is not null and refunded_at between p_since and p_until)      as reembolsos_valor,
      (select count(*) from txf
         where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED','PURCHASE_WAITING_PAYMENT')
           and entry_anchor between p_since and p_until)                                       as aguardando_qtd,
      (select coalesce(sum(price),0) from txf
         where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED','PURCHASE_WAITING_PAYMENT')
           and entry_anchor between p_since and p_until)                                       as aguardando_valor
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

create or replace function public.vendas_utm(p_since timestamptz, p_until timestamptz, p_sck text default null)
returns table(received_at timestamptz, product_name text, price numeric, sck text, src text, utm_source text, utm_campaign text, utm_medium text, utm_content text)
language sql stable as $fn$
  with v as materialized (
    select c.approved_at as received_at, c.product_name, c.price, c.sck, c.src, c.email_norm
    from public.compras_aprovadas c
    where c.viva and not c.teste
      and c.approved_at is not null and c.approved_at between p_since and p_until
      and coalesce(c.familia,'') <> 'Comunidade'
  ),
  vf as (
    select v.received_at, v.product_name, v.price, v.sck,
           coalesce(v.src, (
             select v2.src from v v2
             where v2.email_norm is not null and v2.email_norm = v.email_norm
               and v2.src is not null
               and abs(extract(epoch from (v2.received_at - v.received_at))) <= 1800
             order by abs(extract(epoch from (v2.received_at - v.received_at))) asc
             limit 1
           )) as src
    from v
  ),
  utm as materialized (
    select utm_term,
           mode() within group (order by utm_source)   utm_source,
           mode() within group (order by utm_campaign) utm_campaign,
           mode() within group (order by utm_medium)   utm_medium,
           mode() within group (order by utm_content)  utm_content
    from public.quiz_sessions
    where utm_term is not null and utm_term <> ''
    group by utm_term
  )
  select vf.received_at, vf.product_name, vf.price, vf.sck, vf.src,
         u.utm_source, u.utm_campaign, u.utm_medium, u.utm_content
  from vf left join utm u on u.utm_term = vf.src
  where (p_sck is null or coalesce(vf.sck,'') = p_sck)
  order by vf.received_at desc
$fn$;
