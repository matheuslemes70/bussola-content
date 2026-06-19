-- ============================================================
-- Bússola — Schema inicial
-- ============================================================

-- ---------- Extensões ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role    as enum ('admin', 'social_media', 'designer', 'editor');
create type client_status as enum ('ativo', 'pausado');
create type post_format  as enum ('estatico', 'carrossel', 'reels', 'story');
create type post_status  as enum (
  'a_produzir', 'em_producao', 'pronto_pra_editar',
  'para_aprovacao', 'alterar', 'aprovado', 'publicado'
);
create type comment_type as enum ('interno', 'cliente');

-- ============================================================
-- Tabelas
-- ============================================================

-- ---------- users (perfil público ligado ao auth.users) ----------
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  email      text not null,
  perfil     user_role not null default 'editor',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- clients ----------
create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  avatar_url     text,
  redes_sociais  text[] not null default '{}',
  responsavel_id uuid references public.users(id) on delete set null,
  status         client_status not null default 'ativo',
  created_at     timestamptz not null default now()
);

-- ---------- brand_core (1:1 com client) ----------
create table public.brand_core (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null unique references public.clients(id) on delete cascade,
  persona         text not null default '',
  diagnostico     text not null default '',
  concorrencia    text not null default '',
  posicionamento  text not null default '',
  esteira_produtos text not null default '',
  updated_at      timestamptz not null default now()
);

-- ---------- posts ----------
create table public.posts (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 uuid not null references public.clients(id) on delete cascade,
  titulo                    text not null,
  legenda                   text not null default '',
  formato                   post_format not null default 'estatico',
  drive_link                text,
  data_publicacao_planejada date,
  status                    post_status not null default 'a_produzir',
  responsavel_id            uuid references public.users(id) on delete set null,
  public_token              uuid unique,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index posts_client_id_idx on public.posts(client_id);
create index posts_status_idx    on public.posts(status);
create index posts_data_idx      on public.posts(data_publicacao_planejada);

-- ---------- post_status_history ----------
create table public.post_status_history (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  status     post_status not null,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index psh_post_id_idx on public.post_status_history(post_id);

-- ---------- comments ----------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid references public.users(id) on delete set null,
  author_name text,
  texto       text not null,
  tipo        comment_type not null default 'interno',
  created_at  timestamptz not null default now()
);

create index comments_post_id_idx on public.comments(post_id);

-- ---------- file_folders ----------
create table public.file_folders (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  nome       text not null,
  parent_id  uuid references public.file_folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index file_folders_client_id_idx on public.file_folders(client_id);

-- ---------- files ----------
create table public.files (
  id         uuid primary key default gen_random_uuid(),
  folder_id  uuid references public.file_folders(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  nome       text not null,
  drive_link text not null,
  created_at timestamptz not null default now()
);

create index files_folder_id_idx on public.files(folder_id);
create index files_client_id_idx on public.files(client_id);

-- ============================================================
-- Funções e triggers
-- ============================================================

-- Papel do usuário atual (SECURITY DEFINER evita recursão de RLS na tabela users)
create or replace function public.auth_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select perfil from public.users where id = auth.uid();
$$;

-- Cria perfil público automaticamente quando um auth.user é criado
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create trigger brand_core_set_updated_at
  before update on public.brand_core
  for each row execute function public.set_updated_at();

-- Log automático de histórico de status dos posts
create or replace function public.log_post_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.post_status_history (post_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.post_status_history (post_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger posts_log_status
  after insert or update on public.posts
  for each row execute function public.log_post_status();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.users               enable row level security;
alter table public.clients             enable row level security;
alter table public.brand_core          enable row level security;
alter table public.posts               enable row level security;
alter table public.post_status_history enable row level security;
alter table public.comments            enable row level security;
alter table public.file_folders        enable row level security;
alter table public.files               enable row level security;

-- A página pública de aprovação acessa via service_role (server-side),
-- que ignora RLS. Por isso o papel "anon" não recebe nenhuma policy.

-- ---------- users ----------
create policy "users_select_authenticated" on public.users
  for select to authenticated using (true);
create policy "users_admin_manage" on public.users
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

-- ---------- clients ----------
create policy "clients_select_authenticated" on public.clients
  for select to authenticated using (true);
create policy "clients_write_sm_admin" on public.clients
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media'))
  with check (public.auth_user_role() in ('admin', 'social_media'));

-- ---------- brand_core ----------
create policy "brand_core_select_authenticated" on public.brand_core
  for select to authenticated using (true);
create policy "brand_core_write_sm_admin" on public.brand_core
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media'))
  with check (public.auth_user_role() in ('admin', 'social_media'));

-- ---------- posts (todos os perfis criam/editam) ----------
create policy "posts_select_authenticated" on public.posts
  for select to authenticated using (true);
create policy "posts_insert_authenticated" on public.posts
  for insert to authenticated with check (true);
create policy "posts_update_authenticated" on public.posts
  for update to authenticated using (true) with check (true);
create policy "posts_delete_sm_admin" on public.posts
  for delete to authenticated
  using (public.auth_user_role() in ('admin', 'social_media'));

-- ---------- post_status_history ----------
create policy "psh_select_authenticated" on public.post_status_history
  for select to authenticated using (true);
create policy "psh_insert_authenticated" on public.post_status_history
  for insert to authenticated with check (true);

-- ---------- comments ----------
create policy "comments_select_authenticated" on public.comments
  for select to authenticated using (true);
create policy "comments_insert_authenticated" on public.comments
  for insert to authenticated with check (true);

-- ---------- file_folders ----------
create policy "file_folders_select_authenticated" on public.file_folders
  for select to authenticated using (true);
create policy "file_folders_write_authenticated" on public.file_folders
  for all to authenticated using (true) with check (true);

-- ---------- files ----------
create policy "files_select_authenticated" on public.files
  for select to authenticated using (true);
create policy "files_write_authenticated" on public.files
  for all to authenticated using (true) with check (true);
