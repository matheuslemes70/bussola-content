-- ============================================================
-- Bússola — Legenda (caption) separada do briefing interno
-- ============================================================

-- "Legenda" = texto final da publicação, exibido na aprovação do cliente.
-- "briefing" continua sendo a instrução interna da equipe.
alter table public.posts add column caption text not null default '';
