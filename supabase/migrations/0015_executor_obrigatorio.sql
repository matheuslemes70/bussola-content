-- ============================================================
-- Bussola - Executor (responsavel_id) passa a ser obrigatorio
-- ============================================================
alter table public.posts alter column responsavel_id set not null;
