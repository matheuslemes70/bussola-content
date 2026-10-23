-- ============================================================
-- Bussola - Ideia do post (visivel ao cliente, separada da legenda)
-- ============================================================
alter table public.posts add column ideia text not null default '';
