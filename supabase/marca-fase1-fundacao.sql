-- ════════════════════════════════════════════════════════════════════
-- MARCA · Fase 1 — Fundação (catálogo + canal + visão normalizada + funções)
-- Cole no Supabase → SQL Editor → Run. Seguro rodar de novo (idempotente).
--
-- Entrega as 3 peças da fundação:
--   1) produtos_catalogo  — dicionário que junta nomes crus → produto/família/tipo
--   2) vendas_norm        — view que enriquece cada venda com produto, canal e
--                           e-mail normalizado (a base de TODA a visão da marca)
--   3) marca_resumo / marca_por_canal / marca_por_produto — funções do painel
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1) CATÁLOGO DE PRODUTOS
--    match_tipo: 'exato' (nome igual) ou 'contem' (nome contém o trecho).
--    ordem: menor = checado primeiro (específicos antes do genérico).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.produtos_catalogo (
  id         bigint generated always as identity primary key,
  match_tipo text not null default 'contem',  -- 'exato' | 'contem'
  match_valor text not null,                   -- nome cru / trecho a casar
  gateway    text,                             -- null = qualquer gateway
  produto    text not null,                    -- nome limpo p/ exibir
  familia    text not null,                    -- Efeito Lipo | Comunidade | ...
  tipo       text not null,                    -- principal | upsell | bump | assinatura
  ordem      int  not null default 100
);

-- Semeia o catálogo (recria do zero a cada run pra refletir ajustes).
delete from public.produtos_catalogo;
insert into public.produtos_catalogo (match_tipo, match_valor, produto, familia, tipo, ordem) values
  ('contem', 'vitalíc',              'Efeito Lipo Vitalício', 'Efeito Lipo', 'upsell',     10),
  ('contem', 'vitalic',              'Efeito Lipo Vitalício', 'Efeito Lipo', 'upsell',     11),
  ('contem', 'cinturinha',           'Cinturinha Express',    'Efeito Lipo', 'bump',       20),
  ('contem', 'livro',                'Livro de Receitas',     'Efeito Lipo', 'bump',       30),
  ('contem', 'receitas que secam',   'Receitas que Secam',    'Efeito Lipo', 'bump',       35),
  ('contem', 'planner',              'Planner de Metas',      'Efeito Lipo', 'bump',       40),
  ('contem', 'comunidade',           'Comunidade Corpo Feliz','Comunidade',  'assinatura', 50),
  -- genérico do principal (depois dos específicos): Efeito Lipo / Desafio
  ('contem', 'efeito lipo',          'Efeito Lipo 21D',       'Efeito Lipo', 'principal',  90),
  ('contem', 'desafio efeito',       'Efeito Lipo 21D',       'Efeito Lipo', 'principal',  91);

-- ─────────────────────────────────────────────────────────────────────
-- 2) VIEW vendas_norm — cada venda enriquecida. É a base do painel.
--    Acrescenta: email_norm (chave do cliente), canal (origem do tráfego),
--    e produto/família/tipo (via catálogo). Não altera a tabela vendas.
--
--    CANAL (1ª versão; refinada na Fase 3):
--      • ads        → tem id de conjunto numérico em tracking_src (veio de anúncio)
--      • comercial  → origem 'comercial'/'whatsapp' (venda manual/atendimento)
--      • organico   → origem contém 'organic'
--      • direto     → resto (sem rastreio de campanha)
-- ─────────────────────────────────────────────────────────────────────
create or replace view public.vendas_norm as
select
  v.*,
  nullif(lower(trim(v.buyer_email)), '') as email_norm,
  case
    when v.tracking_src ~ '^[0-9]{6,}$' then 'ads'
    when lower(coalesce(v.tracking_sck,'')) like '%organic%'                       then 'organico'
    when lower(coalesce(v.tracking_sck,'')) like 'comercial%'
      or lower(coalesce(v.tracking_sck,'')) like '%whatsapp%'                      then 'comercial'
    else 'direto'
  end as canal,
  coalesce(c.produto, v.product_name, '(sem nome)') as produto,
  coalesce(c.familia, 'Outros')                     as familia,
  coalesce(c.tipo,    'outro')                       as tipo
from public.vendas v
left join lateral (
  select pc.produto, pc.familia, pc.tipo
  from public.produtos_catalogo pc
  where (pc.gateway is null or pc.gateway = v.gateway)
    and (
      (pc.match_tipo = 'exato'  and lower(trim(coalesce(v.product_name,''))) = lower(trim(pc.match_valor)))
      or (pc.match_tipo = 'contem' and lower(coalesce(v.product_name,'')) like '%' || lower(pc.match_valor) || '%')
    )
  order by pc.ordem asc
  limit 1
) c on true;

-- ─────────────────────────────────────────────────────────────────────
-- 3a) marca_resumo — KPIs da MARCA TODA (todos gateways/canais/produtos) num
--     período. Venda = APROVAÇÃO ancorada na data da aprovação (mesma regra das
--     outras funções). Sem misturar com gasto de Meta aqui (o ROAS por canal
--     fica em marca_por_canal, pra não dividir o gasto por venda orgânica).
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.marca_resumo(timestamptz, timestamptz);
create or replace function public.marca_resumo(p_since timestamptz, p_until timestamptz)
returns table (
  gateway text,
  vendas bigint, itens bigint, receita numeric, liquido numeric,
  reembolsos bigint, reembolsos_valor numeric
)
language sql stable as $fn$
  with tx as (
    select gateway, transaction,
           (array_agg(event order by received_at desc))[1]              as last_event,
           min(received_at)                                             as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED')  as approved_at,
           max(price)                                                   as price,
           max(producer_value)                                         as producer_value,
           max(buyer_email)                                            as buyer_email
    from public.vendas
    where transaction is not null
    group by gateway, transaction
  )
  select
    gateway,
    count(distinct (coalesce(buyer_email, transaction), approved_at::date))
      filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)        as vendas,
    count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)  as itens,
    coalesce(sum(price) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)          as receita,
    coalesce(sum(producer_value) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0) as liquido,
    count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until)               as reembolsos,
    coalesce(sum(price) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until),0) as reembolsos_valor
  from tx
  group by gateway
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 3b) marca_por_canal — vendas líquidas por CANAL (ads/comercial/organico/...)
--     somando todos os gateways. Para o recorte de origem do faturamento.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.marca_por_canal(timestamptz, timestamptz);
create or replace function public.marca_por_canal(p_since timestamptz, p_until timestamptz)
returns table (canal text, vendas bigint, itens bigint, receita numeric, liquido numeric)
language sql stable as $fn$
  with tx as (
    select transaction,
           max(canal)                                                  as canal,
           min(received_at) filter (where event = 'PURCHASE_APPROVED')  as approved_at,
           max(price)                                                   as price,
           max(producer_value)                                         as producer_value,
           max(buyer_email)                                            as buyer_email
    from public.vendas_norm
    where transaction is not null
    group by transaction
  )
  select
    canal,
    count(distinct (coalesce(buyer_email, transaction), approved_at::date))
      filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until) as vendas,
    count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until) as itens,
    coalesce(sum(price) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)          as receita,
    coalesce(sum(producer_value) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0) as liquido
  from tx
  group by canal
  order by receita desc
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 3c) marca_por_produto — vendas líquidas por PRODUTO/FAMÍLIA (catálogo),
--     todos os gateways. Alimenta o catálogo da marca no painel.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.marca_por_produto(timestamptz, timestamptz);
create or replace function public.marca_por_produto(p_since timestamptz, p_until timestamptz)
returns table (
  produto text, familia text, tipo text, gateway text,
  vendas bigint, receita numeric, liquido numeric, reembolsos bigint
)
language sql stable as $fn$
  with tx as (
    select transaction,
           (array_agg(produto order by received_at desc))[1] as produto,
           (array_agg(familia order by received_at desc))[1] as familia,
           (array_agg(tipo    order by received_at desc))[1] as tipo,
           (array_agg(gateway order by received_at desc))[1] as gateway,
           (array_agg(event   order by received_at desc))[1] as last_event,
           min(received_at)                                            as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           max(price)                                                  as price,
           max(producer_value)                                         as producer_value
    from public.vendas_norm
    where transaction is not null
    group by transaction
  )
  select produto, familia, tipo, gateway,
    count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until) as vendas,
    coalesce(sum(price) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)          as receita,
    coalesce(sum(producer_value) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0) as liquido,
    count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until) as reembolsos
  from tx
  group by produto, familia, tipo, gateway
  having count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until) > 0
  order by receita desc
$fn$;
