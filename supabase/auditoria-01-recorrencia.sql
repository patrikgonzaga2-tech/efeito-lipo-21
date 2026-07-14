-- ════════════════════════════════════════════════════════════════════
-- AUDITORIA — Fase 1: RECORRÊNCIA (Comunidade Corpo Feliz)
--
-- Quatro defeitos, uma origem: o painel lia a tabela `assinaturas` como se o
-- vocabulário da Greenn fosse óbvio. Não é.
--
-- O QUE OS DADOS MOSTRAM (medido, não suposto):
--   • status 'ended' NÃO é cancelamento. A Greenn dispara 'ended' na CRIAÇÃO do
--     contrato: das 94 assinaturas nesse estado, 84 têm venda aprovada e 83
--     seguem dentro do período pago. Eram pagantes pintados de vermelho.
--   • status 'canceled' quase sempre NÃO é churn: dos 189, só 30 pagaram alguma
--     vez. Os outros 159 são assinaturas iniciadas e nunca pagas
--     (old_status='processing') — carrinho abandonado, não cliente perdido.
--   • O MRR dividia TUDO por 6, como se todo plano fosse semestral. A tabela já
--     tem `plan_period_days` (30/90/180/365) e ninguém usava.
--
-- ANTES → DEPOIS (medido em 14/07/2026):
--   assinantes    124 (só sobe, nunca churna)   →  121 ativos de verdade
--   cancelados    199 em julho                  →   21 churn real
--   MRR           R$ 6.239,95 (÷6 fixo)         →  R$ 5.807,17 (por plano)
--   lista         84 de 124 em vermelho         →  status derivado do estado real
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- Base comum: cada assinante da Comunidade com a sua ÚLTIMA cobrança paga,
-- o período do plano e o estado real do contrato.
--   • período do plano: do contrato (subscription_id, senão e-mail); se não
--     houver contrato, infere pelo nome do produto. Nunca chuta "6 meses".
--   • cancelado de verdade = contrato 'canceled' vindo de quem já pagou.
--   • 'ended' é ignorado como sinal de churn (é ruído da Greenn).
-- ─────────────────────────────────────────────────────────────────────
create or replace view public.assinantes_norm as
with com as (
  select transaction,
         max(subscriber_code)                                        as sub,
         lower(trim(max(buyer_email)))                               as email,
         max(buyer_name)                                             as nome,
         max(product_name)                                           as pn,
         min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
         (array_agg(event order by received_at desc))[1]             as last_event,
         max(price)                                                  as price
  from public.vendas_norm
  where familia = 'Comunidade' and transaction is not null
  group by transaction
),
pagas as (
  select * from com
  where approved_at is not null
    and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
),
-- Contrato mais recente, por id de assinatura e por e-mail (o id casa 104/124,
-- o e-mail 105/124 — juntos cobrem mais do que qualquer um sozinho).
c_sub as (
  select distinct on (subscription_id) subscription_id as k, plan_period_days as d, status as s, old_status as o
  from public.assinaturas where subscription_id is not null
  order by subscription_id, received_at desc
),
c_mail as (
  select distinct on (lower(trim(buyer_email))) lower(trim(buyer_email)) as k, plan_period_days as d, status as s, old_status as o
  from public.assinaturas where buyer_email is not null
  order by lower(trim(buyer_email)), received_at desc
),
agg as (
  select email,
         max(nome) as nome,
         max(sub)  as sub,
         count(*)  as cobrancas,
         sum(price) as total_pago,
         min(approved_at) as primeira,
         max(approved_at) as ultima
  from pagas group by email
),
ult as (   -- a última cobrança de cada assinante (valor e plano vigentes)
  select distinct on (p.email) p.email, p.price, p.approved_at, p.pn,
         coalesce(cs.s, cm.s) as status_contrato,
         coalesce(cs.o, cm.o) as old_status,
         coalesce(cs.d, cm.d,
           case when p.pn ilike '%anual%'                                 then 365
                when p.pn ilike '%semestral%'                             then 180
                when p.pn ilike '%trimestral%' or p.pn ilike '%3 meses%'  then 90
                when p.pn ilike '%mensal%'                                then 30
                else 30 end) as plano_dias
  from pagas p
  left join c_sub  cs on cs.k = p.sub
  left join c_mail cm on cm.k = p.email
  order by p.email, p.approved_at desc
)
select
  a.email, a.nome, a.sub, a.cobrancas, a.total_pago, a.primeira, a.ultima,
  u.price       as ultimo_valor,
  u.plano_dias,
  u.pn          as plano_nome,
  (u.approved_at + (u.plano_dias || ' days')::interval) as vence_em,
  -- MRR desta assinatura: o valor pago normalizado para 30 dias.
  round(u.price * 30.0 / u.plano_dias, 2) as mrr,
  case
    when u.status_contrato in ('canceled','cancelled')                      then 'cancelado'
    when u.approved_at + (u.plano_dias || ' days')::interval <= now()       then 'expirado'
    else 'ativo'
  end as status
from agg a
join ult u on u.email = a.email;

comment on view public.assinantes_norm is
  'Um assinante da Comunidade por linha, com plano, MRR normalizado e status REAL. O status ignora o "ended" que a Greenn dispara na criação do contrato.';

-- ─────────────────────────────────────────────────────────────────────
-- 1) recorrencia_resumo — cards da tela.
--    assinantes = ATIVOS (antes: todo mundo que já pagou, para sempre).
--    mrr        = soma do MRR normalizado por plano (antes: tudo ÷ 6).
--    cancelados = churn REAL no período (antes: incluía 'ended' na criação,
--                 assinaturas nunca pagas e contratos de outros produtos).
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.recorrencia_resumo(timestamptz, timestamptz);
create or replace function public.recorrencia_resumo(p_since timestamptz, p_until timestamptz)
returns table (
  assinantes bigint, cobrancas bigint, receita_coletada numeric,
  mrr_estimado numeric, arr_estimado numeric, cancelados bigint,
  pagantes_total bigint, expirados bigint
)
language sql stable as $fn$
  with pagantes as (
    select distinct email from public.assinantes_norm
  ),
  churn as (   -- cancelamento REAL: contrato da Comunidade, de quem já pagava
    select count(distinct a.contract_id) as n
    from public.assinaturas a
    left join pagantes p on p.email = lower(trim(a.buyer_email))
    where a.status in ('canceled','cancelled')
      and a.product_name ilike '%comunidade%'
      and (a.old_status in ('paid','active') or p.email is not null)
      and a.received_at >= p_since and a.received_at <= p_until
  ),
  cob as (     -- cobranças pagas dentro do período
    select transaction,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           (array_agg(event order by received_at desc))[1]             as last_event,
           max(price)                                                  as price
    from public.vendas_norm
    where familia = 'Comunidade' and transaction is not null
    group by transaction
  )
  select
    (select count(*) from public.assinantes_norm where status = 'ativo')                  as assinantes,
    (select count(*) from cob where approved_at is not null
        and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
        and approved_at >= p_since and approved_at <= p_until)                            as cobrancas,
    coalesce((select sum(price) from cob where approved_at is not null
        and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
        and approved_at >= p_since and approved_at <= p_until), 0)                        as receita_coletada,
    coalesce((select sum(mrr) from public.assinantes_norm where status = 'ativo'), 0)     as mrr_estimado,
    coalesce((select sum(mrr) from public.assinantes_norm where status = 'ativo'), 0) * 12 as arr_estimado,
    (select n from churn)                                                                 as cancelados,
    (select count(*) from public.assinantes_norm)                                         as pagantes_total,
    (select count(*) from public.assinantes_norm where status = 'expirado')               as expirados
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) recorrencia_lista — a tabela de assinantes.
--    O status agora sai de assinantes_norm: 'ativo' | 'cancelado' | 'expirado'.
--    Some o 'ended' que pintava 84 de 124 pagantes de vermelho.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.recorrencia_lista(int);
create or replace function public.recorrencia_lista(p_limit int default 100)
returns table (
  nome text, email text, sub text, cobrancas bigint,
  total_pago numeric, primeira timestamptz, ultima timestamptz, status text,
  plano text, mrr numeric, vence_em timestamptz
)
language sql stable as $fn$
  select nome, email, sub, cobrancas, total_pago, primeira, ultima, status,
         plano_nome as plano, mrr, vence_em
  from public.assinantes_norm
  order by (status = 'ativo') desc, total_pago desc nulls last
  limit p_limit
$fn$;
