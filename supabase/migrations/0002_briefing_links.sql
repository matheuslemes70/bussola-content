-- ============================================================
-- Bússola — Ajustes: briefing interno + separação de links
-- ============================================================

-- "Legenda" passa a ser o briefing interno para a equipe.
alter table public.posts rename column legenda to briefing;

-- O antigo "drive_link" passa a ser o link de referência (interno).
alter table public.posts rename column drive_link to reference_link;

-- Novo link: conteúdo entregue pelo editor (exibido na aprovação pública).
alter table public.posts add column delivered_link text;
