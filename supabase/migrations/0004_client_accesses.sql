-- ============================================================
-- Bússola — Acessos do cliente (logins/senhas) na aba "Sobre"
-- ============================================================
-- ATENÇÃO: senhas são armazenadas em texto. Por isso o acesso é
-- restrito por RLS a admin e social_media (designers/editores não veem).

create table public.client_accesses (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  plataforma text not null,
  usuario    text not null default '',
  senha      text not null default '',
  created_at timestamptz not null default now()
);

create index client_accesses_client_id_idx on public.client_accesses(client_id);

alter table public.client_accesses enable row level security;

-- Somente admin e social_media podem ver/gerenciar credenciais.
create policy "client_accesses_manage_sm_admin" on public.client_accesses
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media'))
  with check (public.auth_user_role() in ('admin', 'social_media'));
