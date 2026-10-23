-- ============================================================
-- Bussola - Notificacoes internas (atribuicao e mencao @)
-- ============================================================
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  post_id    uuid references public.posts(id) on delete cascade,
  tipo       text not null,
  mensagem   text not null,
  lida       boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications(user_id, lida);

alter table public.notifications enable row level security;

-- Cada usuario ve e atualiza (marcar como lida) apenas suas proprias notificacoes.
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid());

-- Qualquer usuario autenticado pode CRIAR notificacao para outro usuario
-- (ex: ao atribuir uma demanda ou mencionar alguem no chat).
create policy "notifications_insert_any" on public.notifications
  for insert to authenticated
  with check (true);
