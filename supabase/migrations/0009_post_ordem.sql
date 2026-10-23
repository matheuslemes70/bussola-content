-- ============================================================
-- Bússola — Ordem manual dos posts dentro da coluna do kanban
-- ============================================================
-- `ordem` NULL = post nunca reordenado manualmente (mantém a ordenação
-- padrão por data). Ao reordenar uma coluna, os posts recebem 0..N.

alter table public.posts add column ordem integer;

create index posts_ordem_idx on public.posts(ordem);
