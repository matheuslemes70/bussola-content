-- 0025 — Entrega no próprio dia da publicação (rotina semanal)
--
-- O editor entrega no dia em que o post publica. Ajusta a rotina já
-- cadastrada e os posts da rotina que ainda estão em produção.
-- Rodar no SQL Editor do Supabase.

update public.rotina_semanal set dias_antes = 0;

alter table public.rotina_semanal alter column dias_antes set default 0;

update public.posts
set data_entrega = data_publicacao_planejada
where rotina_chave is not null
  and data_publicacao_planejada is not null
  and status in ('a_produzir', 'em_producao', 'pronto_pra_editar', 'alterar');

-- Conferência: posts da rotina desta semana com as datas
select titulo, data_publicacao_planejada as publica, data_entrega as entrega
from public.posts
where rotina_chave is not null
order by data_publicacao_planejada, titulo;
