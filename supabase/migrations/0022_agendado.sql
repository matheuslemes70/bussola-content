-- 0022 — Etapa "Agendado" (Fase 3)
--
-- A social media marca "Agendado" quando programa o post na rede. No dia
-- seguinte à data de publicação, a rotina diária marca como "Publicado".
-- Rodar no SQL Editor do Supabase. Resultado esperado: "Success. No rows returned".

alter type post_status add value if not exists 'agendado' after 'aprovado';
