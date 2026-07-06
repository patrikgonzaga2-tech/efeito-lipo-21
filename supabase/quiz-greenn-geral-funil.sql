-- ════════════════════════════════════════════════════════════════════
-- QUIZ · Greenn nas abas GERAL e FUNIL do Efeito Lipo
-- Cole no Supabase → SQL Editor → Run. Seguro rodar de novo.
-- (Precisa do token sbp_ / service_role NÃO aplica DDL.)
--
-- Por quê: o teste A/B de checkout do quiz manda ~metade dos compradores pro
-- gateway Greenn. Essas vendas SÃO Efeito Lipo, mas as abas Geral e Funil
-- estavam travadas em p_gateway='hotmart' — então metade das conversões do
-- quiz sumia do faturamento e do ROAS.
--
-- O CUIDADO: não dá pra só "liberar o gateway". O webhook da Greenn grava CADA
-- COBRANÇA RECORRENTE DA COMUNIDADE na mesma tabela `vendas` (cada renovação
-- vira um PURCHASE_APPROVED). Se a aba Geral do Efeito Lipo lesse toda a Greenn,
-- puxaria a receita da Comunidade pra dentro do Efeito Lipo e mentiria o número.
--
-- SOLUÇÃO: um novo parâmetro OPCIONAL p_greenn_sck. Quando preenchido, as linhas
-- do gateway Greenn só entram se o funil delas for esse sck (o quiz marca
-- tracking_sck='efeito-lipo-quiz' no checkout). Hotmart continua entrando
-- inteira (é 100% Efeito Lipo). Quando p_greenn_sck é null (painel da Marca,
-- aba Quiz), nada muda — lê tudo como antes.
--
-- HERANÇA DE SCK (igual à herança de src já existente): o order bump da Greenn
-- vira uma transação separada que pode NÃO carregar o sck do produto principal.
-- Sem herança, o bump sumiria do total do quiz. Então, quando uma transação não
-- tem sck próprio, ela herda o sck de OUTRA compra do MESMO comprador na janela
-- de ±30 min — é o mesmo clique de compra, não inventa origem. Assim os bumps
-- Greenn do quiz entram no faturamento mesmo que percam o marcador no checkout.
-- ════════════════════════════════════════════════════════════════════

drop function if exists public.funil_resumo(timestamptz, timestamptz);
drop function if exists public.funil_resumo(timestamptz, timestamptz, boolean);
drop function if exists public.funil_resumo(timestamptz, timestamptz, text);
drop function if exists public.funil_resumo(timestamptz, timestamptz, boolean, text);
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
  -- Uma linha por compra. Trazemos também gateway e sck (além de src) porque o
  -- recorte do quiz na Greenn depende do sck.
  tx0 as (
    select transaction,
           (array_agg(event order by received_at desc))[1]              as last_event,
           min(received_at)                                             as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED')  as approved_at,
           max(price)                                                   as price,
           max(producer_value)                                         as producer_value,
           max(buyer_email)                                            as buyer_email,
           max(gateway)                                                as gateway,
           max(tracking_src) filter (where tracking_src is not null and tracking_src <> '') as src,
           max(tracking_sck) filter (where tracking_sck is not null and tracking_sck <> '') as sck
    from public.vendas
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
  -- Filtros: (1) só anúncio, quando pedido; (2) recorte do quiz na Greenn — a
  -- Hotmart passa inteira (é 100% Efeito Lipo), a Greenn só entra se o funil for
  -- o sck pedido (isola o quiz da Comunidade recorrente).
  txf as (
    select * from tx
    where (not p_only_ads or (eff_src is not null and eff_src <> ''))
      and (p_greenn_sck is null or gateway <> 'greenn' or coalesce(eff_sck,'') = p_greenn_sck)
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
  -- Abandono de carrinho: só Hotmart manda esse evento (a Greenn não), então o
  -- recorte por sck não se aplica aqui — fica o filtro por gateway.
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
