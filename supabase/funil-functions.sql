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
-- VENDA = APROVAÇÃO (ancorada na data em que foi APROVADA): a venda só conta se a
-- transação teve um evento PURCHASE_APPROVED, e ela é ancorada nessa data — é o
-- que a Hotmart chama de "compra aprovada". Isso exclui os FANTASMAS: compras
-- antigas (anteriores ao rastreio) que só mandam o PURCHASE_COMPLETE (fim da
-- garantia, semanas depois) — antes elas entravam como "venda nova" na data
-- errada e sem origem, inflando a aba Geral. Sem APPROVED, não é venda do período.
--
-- Também devolvemos os "baldes de dinheiro na mesa":
--   • reembolsos  = compras pagas e devolvidas (REFUNDED/CHARGEBACK)
--   • aguardando  = boleto/Pix gerado e ainda não pago (BILLET_PRINTED/DELAYED)
--   • abandono    = carrinho abandonado (OUT_OF_SHOPPING_CART) — só quantidade,
--                   a Hotmart não manda valor nesse evento.
-- Período: a VENDA é ancorada na data da aprovação; os outros baldes (reembolso/
-- aguardando) são ancorados em quando a transação ENTROU (1º aviso recebido).
--
-- p_only_ads (opcional): quando true, conta SÓ as vendas que vieram de anúncio
-- (têm tracking_src = id do anúncio). É o que separa a aba "Funil" (só ad-driven;
-- exclui orgânico/sem-rastreio/WhatsApp) da aba "Geral" (todas as origens). O
-- gasto/funil do Meta não muda — é sempre o investimento que alimenta o funil.
--
-- ORDER BUMPS — duas regras importantes (iguais à lógica da aba UTM):
--  1) HERANÇA DE SRC: o bump (Cinturinha, Livro, Vitalício) vira transação
--     separada que NÃO carrega o src do produto principal. Sem isso, o bump
--     sumiria do Funil (que filtra por src). Então, quando uma transação não
--     tem src, ela herda o src de OUTRA compra do MESMO comprador na janela de
--     ±30 min que tenha src — é o mesmo clique de compra, não inventa origem.
--  2) VENDAS = PEDIDOS ÚNICOS: faturamento/líquido somam TODOS os itens (inclui
--     bumps), mas a CONTAGEM de "vendas" é por pedido único (comprador + dia),
--     pra não contar o mesmo cliente várias vezes só porque pegou bumps. Assim
--     ticket médio e CAC ficam por cliente, não por item.
drop function if exists public.funil_resumo(timestamptz, timestamptz);
drop function if exists public.funil_resumo(timestamptz, timestamptz, text);
drop function if exists public.funil_resumo(timestamptz, timestamptz, boolean);
create or replace function public.funil_resumo(p_since timestamptz, p_until timestamptz, p_only_ads boolean default false)
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
  -- Uma linha por compra (transação): estado atual, quando ENTROU, quando foi
  -- APROVADA (null se nunca teve APPROVED = fantasma), valor, comprador e src.
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
    group by transaction
  ),
  -- Herança de src: se a transação não tem src próprio, herda o src da compra do
  -- mesmo comprador mais próxima no tempo (±30 min) que tenha src — é o bump.
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
  -- Aplica só o filtro de anúncio (o período entra por balde, abaixo, porque a
  -- venda é ancorada na aprovação e os outros baldes na entrada).
  txf as (
    select * from tx
    where (not p_only_ads or (eff_src is not null and eff_src <> ''))
  ),
  v as (
    select
      -- VENDAS = pedidos únicos (comprador + dia da aprovação), só transações
      -- que foram APROVADAS dentro do período (exclui os fantasmas COMPLETE-only).
      count(distinct (coalesce(buyer_email, transaction), approved_at::date))
        filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)         as vendas_real,
      -- ITENS VENDIDOS = nº de produtos (transações aprovadas, conta cada bump).
      count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)   as itens_vendidos,
      -- Faturamento/líquido somam TODOS os itens aprovados no período (inclui bumps).
      coalesce(sum(price) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)          as receita_real,
      coalesce(sum(producer_value) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0) as liquido_real,
      -- Reembolso/aguardando: estado ATUAL, ancorados na entrada da transação.
      count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until)                  as reembolsos_qtd,
      coalesce(sum(price) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until),0)     as reembolsos_valor,
      count(*) filter (where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED') and entry_anchor >= p_since and entry_anchor <= p_until)               as aguardando_qtd,
      coalesce(sum(price) filter (where last_event in ('PURCHASE_BILLET_PRINTED','PURCHASE_DELAYED') and entry_anchor >= p_since and entry_anchor <= p_until),0) as aguardando_valor
    from txf
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
         v.vendas_real, v.itens_vendidos, v.receita_real, v.liquido_real,
         v.reembolsos_qtd, v.reembolsos_valor,
         v.aguardando_qtd, v.aguardando_valor, a.abandono_qtd
  from m, v, a
$fn$;
