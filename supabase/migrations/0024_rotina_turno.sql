-- 0024 — Turno na rotina semanal (manhã, tarde ou noite)
-- Para clientes com mais de um post por dia (ex.: Taiguara).
-- Rodar no SQL Editor do Supabase. Resultado esperado: "Success. No rows returned".

alter table public.rotina_semanal add column if not exists turno text
  check (turno is null or turno in ('manha', 'tarde', 'noite'));
