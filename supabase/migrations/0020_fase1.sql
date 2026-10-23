-- 0020 — Fase 1: permissões alinhadas + links de referência recuperados
--
-- Gestora de Projetos: cria/edita clientes (Sobre, acessos, pauta) e exclui posts.
-- Editor e designer: não criam posts (continuam editando os que recebem).
-- Financeiro: só admin.
--
-- Rodar no SQL Editor do Supabase. Pode ser rodado mais de uma vez sem problema.

-- Clientes
drop policy if exists "clients_write_sm_admin" on public.clients;
drop policy if exists "clients_write_gestao" on public.clients;
create policy "clients_write_gestao" on public.clients
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'))
  with check (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'));

-- Sobre o cliente (brand core)
drop policy if exists "brand_core_write_sm_admin" on public.brand_core;
drop policy if exists "brand_core_write_gestao" on public.brand_core;
create policy "brand_core_write_gestao" on public.brand_core
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'))
  with check (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'));

-- Acessos do cliente (senhas criptografadas)
drop policy if exists "client_accesses_manage_sm_admin" on public.client_accesses;
drop policy if exists "client_accesses_manage_gestao" on public.client_accesses;
create policy "client_accesses_manage_gestao" on public.client_accesses
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'))
  with check (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'));

-- Pauta mensal
drop policy if exists "pauta_write_sm_admin" on public.pauta_approvals;
drop policy if exists "pauta_write_gestao" on public.pauta_approvals;
create policy "pauta_write_gestao" on public.pauta_approvals
  for all to authenticated
  using (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'))
  with check (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'));

-- Posts: criar só a gestão; excluir só a gestão (editar continua para todos)
drop policy if exists "posts_insert_authenticated" on public.posts;
drop policy if exists "posts_insert_gestao" on public.posts;
create policy "posts_insert_gestao" on public.posts
  for insert to authenticated
  with check (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'));

drop policy if exists "posts_delete_sm_admin" on public.posts;
drop policy if exists "posts_delete_gestao" on public.posts;
create policy "posts_delete_gestao" on public.posts
  for delete to authenticated
  using (public.auth_user_role() in ('admin', 'social_media', 'gestor_projetos'));

-- Financeiro: só admin
drop policy if exists "client_contracts_manage_financeiro" on public.client_contracts;
drop policy if exists "client_contracts_manage_admin" on public.client_contracts;
create policy "client_contracts_manage_admin" on public.client_contracts
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

drop policy if exists "metas_financeiras_manage_financeiro" on public.metas_financeiras;
drop policy if exists "metas_financeiras_manage_admin" on public.metas_financeiras;
create policy "metas_financeiras_manage_admin" on public.metas_financeiras
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

-- Links de referência: o campo antigo do formulário salvava num lugar que a
-- página do post não mostra. Copia esses links para a lista que aparece no
-- post (sem duplicar os que já estão lá).
insert into public.post_reference_links (post_id, label, url)
select p.id, 'Referência', p.reference_link
from public.posts p
where p.reference_link is not null
  and p.reference_link <> ''
  and not exists (
    select 1 from public.post_reference_links l
    where l.post_id = p.id and l.url = p.reference_link
  );

-- Conferência: lista as regras que ficaram nessas tabelas.
-- Se aparecer alguma regra com nome diferente dos criados acima, ela foi
-- feita direto no Supabase e pode continuar liberando acesso — avise.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('clients', 'brand_core', 'client_accesses', 'pauta_approvals',
                    'posts', 'client_contracts', 'metas_financeiras')
order by tablename, policyname;
