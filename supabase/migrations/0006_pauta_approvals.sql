-- ============================================================
-- Bússola — Aprovação de pauta mensal
-- ============================================================

create type pauta_status as enum ('pendente', 'aprovada', 'ajustes_solicitados');

create table public.pauta_approvals (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  ano             int not null,
  mes             int not null,            -- 1-12
  token           uuid not null unique default gen_random_uuid(),
  status          pauta_status not null default 'pendente',
  incluir_briefing boolean not null default false,
  comentario      text,                    -- comentário geral do cliente
  autor_resposta  text,                    -- nome de quem respondeu
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  unique (client_id, ano, mes)
);

create index pauta_approvals_client_id_idx on public.pauta_approvals(client_id);

alter table public.pauta_approvals enable row level security;

-- A página pública usa service_role (server-side). Sem policy para anon.
create policy "pauta_select_authenticated" on public.pauta_approvals
  for select to authenticated using (true);
create policy "pauta_write_sm_admin" on public.pauta_approvals
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media'))
  with check (public.auth_user_role() in ('admin', 'social_media'));
