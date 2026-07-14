-- ════════════════════════════════════════════════════════════════════
-- AUDITORIA — Fase 5: vendas_utm (aba Origem das vendas)
--
-- O truncamento em 1.000 linhas foi resolvido no FRONT (sbRpcAll pagina a RPC —
-- ver lib/supabase.ts). Aqui resolvemos o ESCOPO e a SINTAXE:
--
-- 1) ESCOPO. A função pegava toda venda aprovada, de qualquer produto. As
--    renovações da Comunidade (ticket R$ 407, contra R$ 36 do quiz) entravam
--    como "(sem rastreio)" — R$ 22.498, 41% da receita exibida. Quem lia o
--    painel concluía "perdi o rastreio de 41% da receita do quiz". Falso: não é
--    rastreio perdido, é assinatura, que por natureza não tem UTM. Agora a
--    Comunidade fica fora e sobra o que a aba promete: o funil do quiz.
--
-- 2) REEMBOLSO. Compra devolvida não é mais contada como venda.
--
-- 3) SINTAXE. O arquivo antigo (utm-functions.sql) estava QUEBRADO: faltava a
--    palavra `with` antes da primeira CTE. A função no banco funcionava (tinha
--    sido criada de outra versão), mas rodar o arquivo dava erro — uma armadilha
--    para quem fosse corrigir. Este arquivo substitui aquele.
--
-- A aba ganha ainda a dimensão CONJUNTO (ID): o nome do conjunto se repete à
-- exaustão no Meta (149 conjuntos reais colapsavam em 13 linhas; "ABERTO"
-- sozinho carregava R$ 22 mil como se fosse um só). O id vem no `src`.
-- ════════════════════════════════════════════════════════════════════

-- limpa a função agregada que virou desnecessária (o explorer cruza dimensões
-- no cliente e precisa das linhas, não do total pronto)
drop function if exists public.vendas_utm_resumo(timestamptz, timestamptz, text, text);

drop function if exists public.vendas_utm(timestamptz, timestamptz);
drop function if exists public.vendas_utm(timestamptz, timestamptz, text);
create or replace function public.vendas_utm(
  p_since timestamptz, p_until timestamptz,
  p_sck text default null   -- funil do quiz; null = todos
)
returns table (
  received_at timestamptz, product_name text, price numeric, sck text, src text,
  utm_source text, utm_campaign text, utm_medium text, utm_content text
)
language sql stable as $fn$
  with tx as (
    -- estado atual de cada transação (pra saber se foi devolvida)
    select transaction,
           (array_agg(event order by received_at desc))[1] as last_event
    from public.vendas
    where transaction is not null
    group by transaction
  ),
  appr as (
    select v.transaction, v.received_at, v.product_name, v.price,
           v.tracking_sck as sck, v.tracking_src as src, v.buyer_email, v.familia,
           row_number() over (partition by v.transaction order by v.received_at asc) as rn
    from public.vendas_norm v
    join tx on tx.transaction = v.transaction
    where v.event = 'PURCHASE_APPROVED'
      and v.received_at >= p_since and v.received_at <= p_until
      -- assinatura da Comunidade não é venda do funil: sem isto, ela aparecia
      -- como "sem rastreio" e parecia atribuição perdida
      and coalesce(v.familia,'') <> 'Comunidade'
      -- compra devolvida não conta
      and tx.last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
  ),
  v as (
    select transaction, received_at, product_name, price, sck, src, buyer_email
    from appr where rn = 1
  ),
  -- Se a venda não tem src, herda o da compra do mesmo comprador mais próxima no
  -- tempo (±30 min) que tenha — é o order bump do mesmo checkout.
  vf as (
    select v.received_at, v.product_name, v.price, v.sck,
           coalesce(v.src, (
             select v2.src from v v2
             where v2.buyer_email is not null
               and v2.buyer_email = v.buyer_email
               and v2.src is not null
               and abs(extract(epoch from (v2.received_at - v.received_at))) <= 1800
             order by abs(extract(epoch from (v2.received_at - v.received_at))) asc
             limit 1
           )) as src
    from v
  ),
  utm as (
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
