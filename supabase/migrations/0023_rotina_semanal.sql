-- 0023 — Rotina semanal de posts
--
-- Cada cliente pode ter uma rotina (ex.: seg Reels com o Fabricio, qua
-- Carrossel com o Daniel). Todo domingo à noite a plataforma cria os posts
-- que publicam na semana seguinte, com título provisório para preencher.
-- Rodar no SQL Editor do Supabase. Pode ser rodado mais de uma vez.

create table if not exists public.rotina_semanal (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  dia_semana  int  not null check (dia_semana between 1 and 7), -- 1 = segunda ... 7 = domingo
  formato     post_format not null default 'reels',
  executor_id uuid not null references public.users(id) on delete cascade,
  dias_antes  int  not null default 2 check (dias_antes between 0 and 10), -- entrega N dias úteis antes
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists rotina_semanal_client_idx on public.rotina_semanal(client_id);

alter table public.rotina_semanal enable row level security;

drop policy if exists "rotina_select_authenticated" on public.rotina_semanal;
create policy "rotina_select_authenticated" on public.rotina_semanal
  for select to authenticated using (true);

drop policy if exists "rotina_write_gestao" on public.rotina_semanal;
create policy "rotina_write_gestao" on public.rotina_semanal
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'))
  with check (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'));

-- Marca os posts criados pela rotina e impede que a mesma semana seja
-- criada duas vezes (ex.: botão "Gerar agora" + rotina de domingo).
alter table public.posts add column if not exists rotina_chave text;
create unique index if not exists posts_rotina_chave_key on public.posts(rotina_chave);
