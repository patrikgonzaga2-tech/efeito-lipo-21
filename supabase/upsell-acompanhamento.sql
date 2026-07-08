-- ════════════════════════════════════════════════════════════════════
-- UPSELL /acompanhamento-up — métricas (visualizações, vendas, conversão)
-- Cole no Supabase → SQL Editor → Run. Idempotente.
--
-- O upsell vende a "Comunidade Corpo Feliz — Trimestral" (product_id 148339)
-- em uma OFERTA específica de R$147 (offer_code '8QUFs9'), via one-click Greenn
-- na página /acompanhamento-up. Como o mesmo produto trimestral também é vendido
-- em OUTRAS ofertas (recorrência avulsa: TCRlbK=210, krf3mz/fp2StG=197), o upsell
-- é isolado pela OFERTA — não pelo produto nem pelo nome.
--
-- FUNIL PÓS-COMPRA (aba Funil): compraram o principal → viram a página de upsell
-- → compraram o upsell. Denominador ("base") = compras aprovadas do PRINCIPAL
-- (Efeito Lipo 21D na Greenn, product_id 181143), que é quem cai na página do
-- upsell. As visualizações vêm da tabela upsell_views (beacon no servidor).
-- Offer/produto/slug são parâmetros: se a Greenn trocar o hash da oferta, muda-se
-- só a constante no front (page.tsx).
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1) upsell_views — 1 linha por VISUALIZAÇÃO da página de upsell.
--    id = id de sessão gerado no navegador (insert-ignore → 1 por sessão,
--    recargas não recontam). slug distingue páginas de upsell futuras.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.upsell_views (
  id        text primary key,                        -- id de sessão (navegador)
  slug      text not null default 'acompanhamento-up',
  xcod      text,                                     -- ponte opcional c/ a venda
  viewed_at timestamptz not null default now()
);
create index if not exists upsell_views_viewed_idx on public.upsell_views(viewed_at desc);
create index if not exists upsell_views_slug_idx    on public.upsell_views(slug);

-- Segurança: igual à tabela vendas — RLS ligada, sem policy p/ chave pública.
-- Só o servidor (service_role, que ignora RLS) grava; o dashboard lê via RPC.
alter table public.upsell_views enable row level security;

-- ─────────────────────────────────────────────────────────────────────
-- 2) upsell_resumo — números do upsell num período: visualizações, vendas,
--    receita/líquido, reembolsos e a base (compras do principal).
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.upsell_resumo(timestamptz, timestamptz, text, text);
drop function if exists public.upsell_resumo(timestamptz, timestamptz, text, text, text);
create or replace function public.upsell_resumo(
  p_since         timestamptz,
  p_until         timestamptz,
  p_upsell_offer  text,   -- offer_code do upsell (ex.: '8QUFs9')
  p_main_product  text,   -- product_id do principal Greenn (ex.: '181143')
  p_slug          text default 'acompanhamento-up'  -- página de upsell (upsell_views.slug)
)
returns table (
  vendas           bigint,   -- vendas aprovadas do upsell no período
  receita          numeric,  -- faturamento bruto do upsell
  liquido          numeric,  -- líquido (producer_value) do upsell
  reembolsos       bigint,   -- reembolsos/chargebacks do upsell
  reembolsos_valor numeric,
  base             bigint,   -- compras do principal (denominador da conversão)
  views            bigint    -- visualizações da página de upsell no período
)
language sql stable as $fn$
  -- Uma linha por transação. Uma compra tem vários eventos (aprovada → reembolso)
  -- e pode ter vários itens (principal + order bumps) na MESMA transação — por
  -- isso usamos bool_or() pra marcar se a transação CONTÉM a oferta do upsell ou
  -- o produto principal, em vez de escolher um item só.
  with tx as (
    select
      transaction,
      max(case when offer_code = p_upsell_offer then 1 else 0 end)  as is_upsell,
      max(case when product_id = p_main_product then 1 else 0 end)  as is_main,
      (array_agg(event order by received_at desc))[1]               as last_event,
      min(received_at)                                              as entry_anchor,
      min(received_at) filter (where event = 'PURCHASE_APPROVED')   as approved_at,
      max(price)          filter (where offer_code = p_upsell_offer) as u_price,
      max(producer_value) filter (where offer_code = p_upsell_offer) as u_liquido
    from public.vendas
    where transaction is not null
    group by transaction
  )
  select
    count(*) filter (
      where is_upsell = 1 and approved_at is not null and approved_at >= p_since and approved_at <= p_until
    )                                                                                        as vendas,
    coalesce(sum(u_price) filter (
      where is_upsell = 1 and approved_at is not null and approved_at >= p_since and approved_at <= p_until
    ), 0)                                                                                    as receita,
    coalesce(sum(u_liquido) filter (
      where is_upsell = 1 and approved_at is not null and approved_at >= p_since and approved_at <= p_until
    ), 0)                                                                                    as liquido,
    count(*) filter (
      where is_upsell = 1 and last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')
        and entry_anchor >= p_since and entry_anchor <= p_until
    )                                                                                        as reembolsos,
    coalesce(sum(u_price) filter (
      where is_upsell = 1 and last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')
        and entry_anchor >= p_since and entry_anchor <= p_until
    ), 0)                                                                                    as reembolsos_valor,
    count(*) filter (
      where is_main = 1 and approved_at is not null and approved_at >= p_since and approved_at <= p_until
    )                                                                                        as base,
    (
      select count(*) from public.upsell_views uv
      where uv.slug = p_slug and uv.viewed_at >= p_since and uv.viewed_at <= p_until
    )                                                                                        as views
  from tx
$fn$;
