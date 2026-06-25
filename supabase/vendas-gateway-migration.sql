-- ════════════════════════════════════════════════════════════════════
-- Operação Corpo Feliz — Migração: coluna `gateway` na tabela vendas
-- Cole no Supabase → SQL Editor → Run.
-- Seguro rodar mais de uma vez (idempotente).
--
-- ⚠️ Aplicar DDL aqui exige o token sbp_ (Personal Access Token). A chave
--    service_role dá 401 nesse contexto — mesma pegadinha dos cards financeiros.
--
-- Por quê: agora a tabela `vendas` guarda Hotmart E Greenn juntas. Esta coluna
-- marca a origem de cada linha. As linhas antigas (Hotmart) viram 'hotmart'
-- automaticamente, então nada quebra no dashboard.
-- ════════════════════════════════════════════════════════════════════

-- 1) Adiciona a coluna com padrão 'hotmart' (preenche o histórico existente).
alter table public.vendas
  add column if not exists gateway text not null default 'hotmart';

-- 2) Índice pra filtrar/agrupar por gateway rápido (ex.: só Greenn, só Hotmart).
create index if not exists vendas_gateway_idx on public.vendas(gateway);

-- Pronto. A partir daqui:
--   • a hotmart-webhook continua gravando (gateway assume 'hotmart' pelo default);
--   • a greenn-webhook grava com gateway = 'greenn' explícito;
--   • o dashboard segue agrupando por product_name — os produtos da Greenn
--     aparecem como linhas novas, e dá pra separar por gateway quando quiser.
