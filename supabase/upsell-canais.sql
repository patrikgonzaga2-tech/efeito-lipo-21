-- ════════════════════════════════════════════════════════════════════
-- UPSELL POR CANAL — página pós-compra × WhatsApp (e qual mensagem vendeu)
--
-- O upsell é oferecido por dois caminhos, e até aqui os dois chegavam no banco
-- iguais (mesma oferta 8QUFs9, mesmo up_id=6097) — não dava pra separar:
--
--   1) PÁGINA (pós-compra): a Greenn redireciona pra /acompanhamento-up com
--      ?token=…&s_id=<id da compra do Efeito Lipo>. Com token, o botão cobra em
--      1 CLIQUE. O payload do one-click da Greenn é fechado (product_id,
--      upsell_id, token, hash_offer, sale_id) — NÃO aceita meta customizado.
--      Logo, essa venda nunca carrega canal por dentro da Greenn; ela é
--      identificada por eliminação (é o único caminho que gera one-click) e,
--      quando existe visualização registrada, pelo s_id.
--
--   2) WHATSAPP: a Laüra manda /acompanhamento-up?c=wa&m=<mensagem>. Sem token,
--      o one-click não cobra — o front leva a cliente pro CHECKOUT da oferta com
--      ?up_canal=wa&up_msg=<mensagem>. A Greenn guarda qualquer parâmetro da URL
--      do checkout em saleMetas (é assim que 'variante' e 'v' já chegam aqui),
--      então a venda carrega o canal e a mensagem NELA MESMA. Determinístico.
--
-- Usamos parâmetros PRÓPRIOS (up_canal/up_msg) de propósito: utm_term/utm_source/
-- utm_content já têm dono (conjunto de anúncio, origem e ponte com o anúncio) e
-- sujá-los quebraria ROAS/CAC.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1) upsell_views ganha canal, mensagem e o id da compra que originou a visita.
--    sale_id = s_id da URL = transaction da compra do PRINCIPAL (mesmo número
--    que a gente já grava em vendas.transaction) — é a ponte entre quem viu a
--    página e a venda do upsell, quando o link do WhatsApp levar token junto.
-- ─────────────────────────────────────────────────────────────────────
alter table public.upsell_views add column if not exists canal   text;
alter table public.upsell_views add column if not exists msg     text;
alter table public.upsell_views add column if not exists sale_id text;

create index if not exists upsell_views_canal_idx   on public.upsell_views(canal);
create index if not exists upsell_views_sale_id_idx on public.upsell_views(sale_id);

-- Visitas gravadas antes deste rastreio só podiam vir do redirect pós-compra
-- (o link de WhatsApp com ?c= não existia): canal = 'pagina'.
update public.upsell_views set canal = 'pagina' where canal is null;

-- ─────────────────────────────────────────────────────────────────────
-- 2) upsell_canais — vendas, receita, líquido e visualizações POR CANAL e POR
--    MENSAGEM, no período. Uma linha por (canal, msg).
--
--    Canal de cada venda, em ordem de confiança:
--      a) up_canal/up_msg gravados na própria venda (caminho WhatsApp → checkout);
--      b) a visualização que originou a compra, casada pelo s_id → e-mail da
--         compradora (caso a Laüra mande o link COM token e o 1-clique cobre);
--      c) 'pagina' — sobrou o redirect pós-compra.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.upsell_canais(timestamptz, timestamptz, text, text, text);
create or replace function public.upsell_canais(
  p_since        timestamptz,
  p_until        timestamptz,
  p_upsell_offer text,                             -- '8QUFs9'
  p_main_product text,                             -- '181143' (Efeito Lipo Greenn)
  p_slug         text default 'acompanhamento-up'
)
returns table (
  canal   text,
  msg     text,
  vendas  bigint,
  receita numeric,
  liquido numeric,
  views   bigint
)
language sql stable as $fn$
  with meta as (   -- saleMetas achatado: 1 linha por (venda, chave)
    select v.transaction,
           max(case when m->>'meta_key' = 'up_canal' then m->>'meta_value' end) as up_canal,
           max(case when m->>'meta_key' = 'up_msg'   then m->>'meta_value' end) as up_msg
    from public.vendas v
    left join lateral jsonb_array_elements(coalesce(v.raw->'saleMetas','[]'::jsonb)) m on true
    where v.transaction is not null
    group by v.transaction
  ),
  tx as (          -- 1 linha por transação (uma compra tem vários eventos)
    select
      v.transaction,
      max(case when v.offer_code = p_upsell_offer then 1 else 0 end) as is_upsell,
      (array_agg(v.event order by v.received_at desc))[1]            as last_event,
      min(v.received_at) filter (where v.event = 'PURCHASE_APPROVED') as approved_at,
      max(v.price)          filter (where v.offer_code = p_upsell_offer) as u_price,
      max(v.producer_value) filter (where v.offer_code = p_upsell_offer) as u_liquido,
      lower(trim(max(v.buyer_email)))                                 as email
    from public.vendas v
    where v.transaction is not null
    group by v.transaction
  ),
  upsell as (      -- vendas VIVAS do upsell no período, sem compra de teste
    select t.*, m.up_canal, m.up_msg
    from tx t
    join meta m on m.transaction = t.transaction
    left join public.emails_teste e on e.email = t.email
    where t.is_upsell = 1
      and e.email is null
      and t.last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
      and t.approved_at between p_since and p_until
  ),
  -- (b) ponte pela visualização: compra do principal da mesma cliente (s_id) →
  -- a última visita registrada antes da venda do upsell.
  atribuida as (
    select
      u.transaction, u.u_price, u.u_liquido,
      coalesce(u.up_canal, vw.canal, 'pagina') as canal,
      coalesce(u.up_msg,   vw.msg)             as msg
    from upsell u
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
    -- Visita gravada pelo front ANTIGO não tem canal/msg — mas tem xcod, e o
    -- link do WhatsApp marca a mensagem nele (d1-oferta-abre…). Quando o xcod
    -- tem letra, é código de mensagem → WhatsApp; só número é xcod de anúncio,
    -- que vem no redirect pós-compra → página. Some quando o front subir.
    select
      coalesce(canal, case when xcod ~ '[a-zA-Z]' then 'wa' else 'pagina' end) as canal,
      coalesce(msg,   case when xcod ~ '[a-zA-Z]' then xcod end, '—')          as msg,
      count(*)::bigint as views
    from public.upsell_views
    where slug = p_slug and viewed_at between p_since and p_until
    group by 1, 2
  )
  -- full join: canal que teve visita sem venda (e vice-versa) precisa aparecer
  select
    coalesce(vc.canal, wc.canal)               as canal,
    coalesce(vc.msg, wc.msg)                   as msg,
    coalesce(vc.vendas, 0)::bigint             as vendas,
    coalesce(vc.receita, 0)                    as receita,
    coalesce(vc.liquido, 0)                    as liquido,
    coalesce(wc.views, 0)::bigint              as views
  from vendas_canal vc
  full join views_canal wc on wc.canal = vc.canal and wc.msg = vc.msg
  order by 3 desc, 6 desc
$fn$;
