-- ════════════════════════════════════════════════════════════════════
-- AUDITORIA — Fase 4: ANÚNCIOS e UTM
--
-- 1) vendas_por_anuncio / vendas_por_conjunto: só receita QUE VEIO DE ANÚNCIO,
--    e sem contar compra devolvida.
--    • A tabela de anúncios pegava TODAS as vendas da marca, sem exigir que
--      tivessem vindo de anúncio: R$ 31.420 de renovação da Comunidade (ticket
--      R$ 407, contra R$ 36 do quiz) entravam como "(sem anúncio identificado)",
--      43% da tabela.
--    • Reembolso nunca era descontado do ROAS: a receita de uma compra devolvida
--      seguia creditada ao conjunto para sempre.
--
-- 2) vendas_utm → AGREGADA no banco. Antes devolvia UMA LINHA POR VENDA e o
--    PostgREST cortava em 1.000 linhas: julho tem 1.350 vendas, então R$ 20.503
--    (27% da receita) sumiam da tela — e o filtro "todo o período" devolvia
--    exatamente os mesmos números do mês atual, porque o corte batia antes.
--    Agora o banco devolve o total por dimensão (dezenas de linhas), não a lista.
--    De quebra, ganha a dimensão CONJUNTO (ID) — antes só existia o nome, e 149
--    conjuntos reais colapsavam em 13 linhas ("ABERTO" sozinho carregava
--    R$ 22 mil como se fosse um conjunto só).
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1a) vendas_por_conjunto — receita real por CONJUNTO (id = tracking_src).
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.vendas_por_conjunto(timestamptz, timestamptz);
create or replace function public.vendas_por_conjunto(p_since timestamptz, p_until timestamptz)
returns table (adset_id text, vendas bigint, itens bigint, receita numeric, liquido numeric)
language sql stable as $fn$
  with tx0 as (
    select transaction,
           (array_agg(event order by received_at desc))[1]             as last_event,
           min(received_at)                                            as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           max(price)                                                  as price,
           max(producer_value)                                         as producer_value,
           max(buyer_email)                                            as buyer_email,
           max(tracking_src) filter (where tracking_src is not null and tracking_src <> '') as src
    from public.vendas
    where transaction is not null
    group by transaction
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
           )) as eff_src
    from tx0 t
  )
  select eff_src as adset_id,
         count(distinct (coalesce(buyer_email, transaction), approved_at::date)) as vendas,
         count(*)                           as itens,
         coalesce(sum(price),0)             as receita,
         coalesce(sum(producer_value),0)    as liquido
  from tx
  where approved_at is not null and approved_at >= p_since and approved_at <= p_until
    and eff_src ~ '^[0-9]{6,}$'
    -- compra devolvida não conta como retorno do anúncio
    and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
  group by eff_src
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 1b) vendas_por_anuncio — receita real por ANÚNCIO (nome, via sessão do quiz).
--     O adset_id volta junto: é ele que permite casar o gasto por
--     CONJUNTO+NOME no front (o link não carrega o id do criativo).
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.vendas_por_anuncio(timestamptz, timestamptz);
create or replace function public.vendas_por_anuncio(p_since timestamptz, p_until timestamptz)
returns table (anuncio text, adset_id text, vendas bigint, itens bigint, receita numeric, liquido numeric)
language sql stable as $fn$
  with tx0 as (
    select transaction,
           (array_agg(event order by received_at desc))[1]             as last_event,
           min(received_at)                                            as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           max(price)                                                  as price,
           max(producer_value)                                         as producer_value,
           max(buyer_email)                                            as buyer_email,
           max(tracking_src) filter (where tracking_src is not null and tracking_src <> '')  as src,
           max(tracking_xcod) filter (where tracking_xcod is not null and tracking_xcod <> '') as xcod
    from public.vendas
    where transaction is not null
    group by transaction
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
           )) as eff_src
    from tx0 t
  ),
  sess as (
    select xcod,
           mode() within group (order by utm_content) as anuncio,
           mode() within group (order by utm_term)    as adset_id
    from public.quiz_sessions
    where xcod is not null and xcod <> ''
    group by xcod
  )
  select coalesce(nullif(s.anuncio, ''), '(sem anúncio identificado)') as anuncio,
         coalesce(s.adset_id, tx.eff_src)                              as adset_id,
         count(distinct (coalesce(tx.buyer_email, tx.transaction), tx.approved_at::date)) as vendas,
         count(*)                          as itens,
         coalesce(sum(tx.price),0)         as receita,
         coalesce(sum(tx.producer_value),0) as liquido
  from tx
  left join sess s on s.xcod = tx.xcod
  where tx.approved_at is not null and tx.approved_at >= p_since and tx.approved_at <= p_until
    -- SÓ venda que veio de anúncio (antes entravam as assinaturas da Comunidade)
    and tx.eff_src ~ '^[0-9]{6,}$'
    and tx.last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
  group by 1, 2
  order by receita desc
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) vendas_utm_resumo — AGREGADA por dimensão. Substitui o vendas_utm que
--    devolvia venda a venda e era truncado em 1.000 linhas pela API.
--    p_dim: 'origem' | 'campanha' | 'conjunto' | 'conjunto_id' | 'anuncio' | 'sem_rastreio'
--    Só o funil do quiz (p_sck), pra assinatura da Comunidade não entrar como
--    "venda sem rastreio" — era 41% da receita exibida e parecia rastreio perdido.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.vendas_utm_resumo(timestamptz, timestamptz, text, text);
create or replace function public.vendas_utm_resumo(
  p_since timestamptz, p_until timestamptz,
  p_dim text default 'origem',
  p_sck text default null
)
returns table (chave text, detalhe text, vendas bigint, itens bigint, receita numeric, liquido numeric)
language sql stable as $fn$
  with tx0 as (
    select transaction,
           (array_agg(event order by received_at desc))[1]             as last_event,
           min(received_at)                                            as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           max(price)                                                  as price,
           max(producer_value)                                         as producer_value,
           max(buyer_email)                                            as buyer_email,
           max(familia)                                                as familia,
           max(tracking_src)  filter (where tracking_src  is not null and tracking_src  <> '') as src,
           max(tracking_sck)  filter (where tracking_sck  is not null and tracking_sck  <> '') as sck,
           max(tracking_xcod) filter (where tracking_xcod is not null and tracking_xcod <> '') as xcod
    from public.vendas_norm
    where transaction is not null
    group by transaction
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
           )) as eff_src
    from tx0 t
  ),
  base as (
    select tx.*,
           s.utm_campaign, s.utm_medium, s.utm_content, s.utm_term
    from tx
    left join lateral (
      select mode() within group (order by utm_campaign) as utm_campaign,
             mode() within group (order by utm_medium)   as utm_medium,
             mode() within group (order by utm_content)  as utm_content,
             mode() within group (order by utm_term)     as utm_term
      from public.quiz_sessions q
      where q.xcod = tx.xcod and tx.xcod is not null
    ) s on true
    where tx.approved_at is not null
      and tx.approved_at >= p_since and tx.approved_at <= p_until
      and tx.last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
      and coalesce(tx.familia,'') <> 'Comunidade'
      and (p_sck is null or coalesce(tx.sck,'') = p_sck)
  )
  select
    case p_dim
      when 'campanha'    then coalesce(nullif(utm_campaign,''), '(sem campanha)')
      when 'conjunto'    then coalesce(nullif(utm_medium,''),   '(sem conjunto)')
      when 'conjunto_id' then coalesce(nullif(eff_src,''),      '(sem id)')
      when 'anuncio'     then coalesce(nullif(utm_content,''),  '(sem anúncio)')
      else case when eff_src ~ '^[0-9]{6,}$' then 'Anúncio (com rastreio)' else 'Sem rastreio' end
    end as chave,
    -- detalhe: o id do conjunto ao lado do nome, pra nomes repetidos não
    -- colapsarem dezenas de conjuntos numa linha só
    case p_dim
      when 'conjunto' then coalesce(nullif(eff_src,''), '')
      when 'anuncio'  then coalesce(nullif(utm_medium,''), '')
      else ''
    end as detalhe,
    count(distinct (coalesce(buyer_email, transaction), approved_at::date)) as vendas,
    count(*)                        as itens,
    coalesce(sum(price),0)          as receita,
    coalesce(sum(producer_value),0) as liquido
  from base
  group by 1, 2
  order by receita desc
$fn$;
