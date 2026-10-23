-- ============================================================
-- Bússola — Anexos de imagem por post (referência para o editor)
-- ============================================================
create table public.post_attachments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  nome        text not null default '',
  created_at  timestamptz not null default now()
);

create index post_attachments_post_id_idx on public.post_attachments(post_id);

alter table public.post_attachments enable row level security;

create policy "post_attachments_manage_authenticated" on public.post_attachments
  for all to authenticated
  using (true)
  with check (true);
