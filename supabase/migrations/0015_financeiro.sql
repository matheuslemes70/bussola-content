-- ============================================================
-- Bússola — Dashboard financeiro (faturamento e metas)
-- ============================================================
-- Acesso restrito a admin e gestor_projetos (dado sensível).

create table public.client_contracts (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients(id) on delete cascade,
  valor_mensal          numeric not null,
  data_inicio           date not null default current_date,
  data_fim              date,
  status                text not null default 'ativo', -- ativo | pausado | cancelado
  motivo_cancelamento   text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index client_contracts_client_id_idx on public.client_contracts(client_id);
create index client_contracts_status_idx on public.client_contracts(status);

alter table public.client_contracts enable row level security;

create policy "client_contracts_manage_financeiro" on public.client_contracts
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'gestor_projetos'))
  with check (public.auth_user_role() in ('admin', 'gestor_projetos'));

create table public.metas_financeiras (
  id           uuid primary key default gen_random_uuid(),
  mes          int not null check (mes between 1 and 12),
  ano          int not null,
  valor_meta   numeric not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (mes, ano)
);

alter table public.metas_financeiras enable row level security;

create policy "metas_financeiras_manage_financeiro" on public.metas_financeiras
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'gestor_projetos'))
  with check (public.auth_user_role() in ('admin', 'gestor_projetos'));
