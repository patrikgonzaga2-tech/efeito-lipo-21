-- ════════════════════════════════════════════════════════════════════
-- AUDITORIA — Fase 3: CANAIS (a Comunidade deixa de se disfarçar de "direto")
--
-- O canal "Direto" era apresentado como origem de tráfego. Não era: 95% dele
-- (R$ 27.496,91 de R$ 28.872 em julho) é COBRANÇA DE ASSINATURA da Comunidade,
-- que por natureza chega sem rastreio. O painel dizia "R$ 32 mil faturados sem
-- mídia" — sugerindo que o melhor negócio da casa era o tráfego direto, com
-- ROAS ∞ e CAC R$ 0. É receita da base pagando de novo, não aquisição.
--
-- Agora existe o canal 'recorrencia': assinatura sem rastreio de campanha.
-- O "direto" volta a significar o que o nome diz — e encolhe de R$ 28.872 para
-- ~R$ 1.375, que é o tamanho real dele.
--
-- A ordem dos testes importa: 'ads' continua vindo primeiro, então uma
-- assinatura VENDIDA por anúncio (com src numérico) segue creditada ao anúncio.
-- Só cai em 'recorrencia' a assinatura que chegou sem rastreio nenhum.
-- ════════════════════════════════════════════════════════════════════

create or replace view public.vendas_norm as
select
  v.*,
  nullif(lower(trim(v.buyer_email)), '') as email_norm,
  case
    when v.tracking_src ~ '^[0-9]{6,}$' then 'ads'
    when lower(coalesce(v.tracking_sck,'')) like '%organic%'                       then 'organico'
    when lower(coalesce(v.tracking_sck,'')) like 'comercial%'
      or lower(coalesce(v.tracking_sck,'')) like '%whatsapp%'                      then 'comercial'
    -- Assinatura sem rastreio de campanha = receita recorrente da base, não
    -- tráfego direto. Sem esta linha, a Comunidade virava 95% do "direto" e
    -- fazia o painel prometer faturamento "sem mídia" que não é aquisição.
    when coalesce(c.tipo,'') = 'assinatura'                                        then 'recorrencia'
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

-- Produto que faltava no catálogo (ainda sem venda aprovada, mas já com PIX
-- gerado): sem isto, quando vender vira uma família "Outros" fantasma na Visão
-- Geral e um eixo novo na matriz de cross-sell.
insert into public.produtos_catalogo (match_tipo, match_valor, produto, familia, tipo, ordem)
select 'contem', 'barriga em 21 dias', 'Efeito Lipo 21D', 'Efeito Lipo', 'principal', 92
where not exists (select 1 from public.produtos_catalogo where match_valor = 'barriga em 21 dias');
