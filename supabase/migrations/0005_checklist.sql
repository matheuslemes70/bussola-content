-- ============================================================
-- Bússola — Checklist de subtarefas dentro do post
-- ============================================================

create table public.post_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  texto      text not null,
  concluido  boolean not null default false,
  created_at timestamptz not null default now()
);

create index post_checklist_post_id_idx on public.post_checklist_items(post_id);

alter table public.post_checklist_items enable row level security;

-- Mesma regra dos posts: qualquer usuário autenticado gerencia.
create policy "checklist_select_authenticated" on public.post_checklist_items
  for select to authenticated using (true);
create policy "checklist_write_authenticated" on public.post_checklist_items
  for all to authenticated using (true) with check (true);
