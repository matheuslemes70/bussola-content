-- ============================================================
-- Bússola — CRM de prospecção (pipeline de novos clientes)
-- ============================================================
-- Acesso restrito a admin (visão estratégica de vendas).
create table public.prospects (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  contato          text not null default '',
  origem           text not null default 'organico', -- organico | pago | indicacao | outbound
  etapa            text not null default 'lead',      -- lead | contato | proposta | fechado | perdido
  valor_estimado   numeric,
  observacoes      text not null default '',
  responsavel_id   uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index prospects_etapa_idx on public.prospects(etapa);

alter table public.prospects enable row level security;

create policy "prospects_manage_admin" on public.prospects
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');
