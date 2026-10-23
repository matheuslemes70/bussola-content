-- 0021 — Etapa "Revisão interna" (Fase 2)
--
-- O executor entrega → a social media (dona da demanda) revisa → só então
-- o post vai para o cliente. Rodar no SQL Editor do Supabase.
-- Resultado esperado: "Success. No rows returned".

alter type post_status add value if not exists 'revisao_interna' before 'para_aprovacao';
