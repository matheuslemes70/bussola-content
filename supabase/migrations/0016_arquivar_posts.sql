-- ============================================================
-- Bussola - Arquivar posts (ideias guardadas, fora do fluxo ativo)
-- ============================================================
alter table public.posts add column arquivado boolean not null default false;
create index posts_arquivado_idx on public.posts(arquivado);
