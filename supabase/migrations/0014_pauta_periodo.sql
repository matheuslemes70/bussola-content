-- ============================================================
-- Bússola — Aprovação de pauta por período específico (não só mês inteiro)
-- ============================================================
alter table public.pauta_approvals add column data_inicio date;
alter table public.pauta_approvals add column data_fim date;

-- A trava antiga (1 pauta por mês) só vale para envios de mês inteiro.
-- Envios de período específico (data_inicio preenchida) podem coexistir.
alter table public.pauta_approvals drop constraint pauta_approvals_client_id_ano_mes_key;
create unique index pauta_approvals_month_unique
  on public.pauta_approvals (client_id, ano, mes)
  where data_inicio is null;
