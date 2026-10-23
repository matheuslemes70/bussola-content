-- ============================================================
-- Bússola — Múltiplos links de referência por post (com rótulo)
-- ============================================================
create table public.post_reference_links (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  label      text not null,
  url        text not null,
  created_at timestamptz not null default now()
);

create index post_reference_links_post_id_idx on public.post_reference_links(post_id);

alter table public.post_reference_links enable row level security;

-- Mesmo padrão de acesso dos posts: todo usuário autenticado gerencia.
create policy "post_reference_links_manage_authenticated" on public.post_reference_links
  for all to authenticated
  using (true)
  with check (true);

-- Migra o link único existente (reference_link) para a nova tabela, se houver.
insert into public.post_reference_links (post_id, label, url)
select id, 'Referência', reference_link
from public.posts
where reference_link is not null and reference_link <> '';
