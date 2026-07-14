-- ════════════════════════════════════════════════════════════════════
-- UPSELL — troca da oferta (14/07/2026) e duas mudanças que ela força
--
-- Oferta antiga: 8QUFs9 · R$147 · cobrança ÚNICA   (upsell Greenn 6097)
-- Oferta nova:   O8j7nc · R$97  · RENOVA a cada 90 dias (upsell Greenn 6152)
--
-- 1) DUAS OFERTAS CONVIVEM. As vendas antigas continuam amarradas ao hash
--    8QUFs9. Se a RPC passasse a olhar só a nova, o histórico do upsell sumiria
--    da tela no dia da troca. Por isso p_upsell_offer (text) vira
--    p_upsell_offers (text[]): o painel manda as duas.
--
-- 2) RENOVAÇÃO NÃO É VENDA NOVA DO UPSELL. A oferta nova é assinatura: daqui a
--    3 meses a Greenn vai cobrar de novo, gerando uma transação nova com o MESMO
--    offer_code. Sem tratar isso, cada renovação entraria como "venda do upsell"
--    e a taxa de conversão da página subiria sozinha, sem ninguém ter comprado.
--    Regra: venda do upsell = a PRIMEIRA compra de cada cliente naquelas ofertas.
--    As renovações são receita recorrente e já aparecem na aba Recorrência
--    (família Comunidade) — contá-las aqui seria contar o mesmo dinheiro duas
--    vezes em duas telas.
-- ════════════════════════════════════════════════════════════════════

drop function if exists public.upsell_resumo(timestamptz, timestamptz, text, text, text);
create or replace function public.upsell_resumo(
  p_since         timestamptz,
  p_until         timestamptz,
  p_upsell_offers text[],   -- ofertas do upsell: {'O8j7nc','8QUFs9'}
  p_main_product  text,     -- '181143' (Efeito Lipo 21D na Greenn)
  p_slug          text default 'acompanhamento-up'
)
returns table (
  vendas bigint, receita numeric, liquido numeric,
  reembolsos bigint, reembolsos_valor numeric,
  base bigint, views bigint, views_desde timestamptz
)
language sql stable as $fn$
  with tx as (
    select
      transaction,
      max(case when offer_code = any(p_upsell_offers) then 1 else 0 end) as is_upsell,
      max(case when product_id = p_main_product       then 1 else 0 end) as is_main,
      (array_agg(event order by received_at desc))[1]                    as last_event,
      min(received_at) filter (where event = 'PURCHASE_APPROVED')        as approved_at,
      max(received_at) filter (where event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')) as refunded_at,
      max(price)          filter (where offer_code = any(p_upsell_offers)) as u_price,
      max(producer_value) filter (where offer_code = any(p_upsell_offers)) as u_liquido,
      lower(trim(max(buyer_email)))                                      as email
    from public.vendas
    where transaction is not null
    group by transaction
  ),
  txr as (   -- fora as compras de teste
    select t.* from tx t
    left join public.emails_teste e on e.email = t.email
    where e.email is null
  ),
  viva as (  -- venda devolvida não é venda
    select * from txr
    where last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
  ),
  -- A PRIMEIRA compra de cada cliente no upsell. A 2ª, 3ª… são renovações da
  -- assinatura — receita recorrente, não conversão nova da página.
  primeira as (
    select distinct on (email) *
    from viva
    where is_upsell = 1 and approved_at is not null and email is not null
    order by email, approved_at asc
  )
  select
    (select count(*) from primeira
      where approved_at between p_since and p_until)                            as vendas,
    (select coalesce(sum(u_price),0) from primeira
      where approved_at between p_since and p_until)                            as receita,
    (select coalesce(sum(u_liquido),0) from primeira
      where approved_at between p_since and p_until)                            as liquido,
    (select count(*) from txr
      where is_upsell = 1 and refunded_at between p_since and p_until)          as reembolsos,
    (select coalesce(sum(u_price),0) from txr
      where is_upsell = 1 and refunded_at between p_since and p_until)          as reembolsos_valor,
    (select count(*) from viva
      where is_main = 1 and approved_at between p_since and p_until)            as base,
    (select count(*) from public.upsell_views uv
      where uv.slug = p_slug and uv.viewed_at between p_since and p_until)      as views,
    (select min(viewed_at) from public.upsell_views uv where uv.slug = p_slug)  as views_desde
$fn$;

drop function if exists public.upsell_canais(timestamptz, timestamptz, text, text, text);
create or replace function public.upsell_canais(
  p_since         timestamptz,
  p_until         timestamptz,
  p_upsell_offers text[],
  p_main_product  text,
  p_slug          text default 'acompanhamento-up'
)
returns table (canal text, msg text, vendas bigint, receita numeric, liquido numeric, views bigint)
language sql stable as $fn$
  with meta as (
    select v.transaction,
           max(case when m->>'meta_key' = 'up_canal' then m->>'meta_value' end) as up_canal,
           max(case when m->>'meta_key' = 'up_msg'   then m->>'meta_value' end) as up_msg
    from public.vendas v
    left join lateral jsonb_array_elements(coalesce(v.raw->'saleMetas','[]'::jsonb)) m on true
    where v.transaction is not null
    group by v.transaction
  ),
  tx as (
    select
      v.transaction,
      max(case when v.offer_code = any(p_upsell_offers) then 1 else 0 end) as is_upsell,
      (array_agg(v.event order by v.received_at desc))[1]                  as last_event,
      min(v.received_at) filter (where v.event = 'PURCHASE_APPROVED')      as approved_at,
      max(v.price)          filter (where v.offer_code = any(p_upsell_offers)) as u_price,
      max(v.producer_value) filter (where v.offer_code = any(p_upsell_offers)) as u_liquido,
      lower(trim(max(v.buyer_email)))                                      as email
    from public.vendas v
    where v.transaction is not null
    group by v.transaction
  ),
  upsell as (
    select t.*, m.up_canal, m.up_msg
    from tx t
    join meta m on m.transaction = t.transaction
    left join public.emails_teste e on e.email = t.email
    where t.is_upsell = 1
      and e.email is null
      and t.last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
      and t.approved_at is not null
  ),
  -- só a 1ª compra de cada cliente (renovação não é conversão nova da página)
  primeira as (
    select distinct on (email) *
    from upsell where email is not null
    order by email, approved_at asc
  ),
  no_periodo as (
    select * from primeira where approved_at between p_since and p_until
  ),
  atribuida as (
    select
      u.transaction, u.u_price, u.u_liquido,
      coalesce(u.up_canal, vw.canal, 'pagina') as canal,
      coalesce(u.up_msg,   vw.msg)             as msg
    from no_periodo u
    left join lateral (
      select uv.canal, uv.msg
      from public.upsell_views uv
      join public.vendas p
        on p.transaction = uv.sale_id
       and p.product_id  = p_main_product
       and lower(trim(p.buyer_email)) = u.email
      where uv.slug = p_slug and uv.viewed_at <= u.approved_at
      order by uv.viewed_at desc
      limit 1
    ) vw on true
  ),
  vendas_canal as (
    select canal, coalesce(msg,'—') as msg,
           count(*)::bigint as vendas,
           coalesce(sum(u_price),0)   as receita,
           coalesce(sum(u_liquido),0) as liquido
    from atribuida group by 1, 2
  ),
  views_canal as (
    select
      coalesce(canal, case when xcod ~ '[a-zA-Z]' then 'wa' else 'pagina' end) as canal,
      coalesce(msg,   case when xcod ~ '[a-zA-Z]' then xcod end, '—')          as msg,
      count(*)::bigint as views
    from public.upsell_views
    where slug = p_slug and viewed_at between p_since and p_until
    group by 1, 2
  )
  select
    coalesce(vc.canal, wc.canal), coalesce(vc.msg, wc.msg),
    coalesce(vc.vendas, 0)::bigint, coalesce(vc.receita, 0), coalesce(vc.liquido, 0),
    coalesce(wc.views, 0)::bigint
  from vendas_canal vc
  full join views_canal wc on wc.canal = vc.canal and wc.msg = vc.msg
  order by 3 desc, 6 desc
$fn$;
