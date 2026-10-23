-- ============================================================
-- Bússola — Separar "dono da demanda" de "executor" nos posts
-- ============================================================
-- responsavel_id passa a significar o EXECUTOR (quem produz).
-- dono_id é quem definiu/solicitou a demanda (pode ser o mesmo ou não).
alter table public.posts add column dono_id uuid references public.users(id) on delete set null;

-- Por padrão, preenche o dono com o mesmo valor do responsável atual
-- (evita ficar tudo em branco nos posts já existentes).
update public.posts set dono_id = responsavel_id where dono_id is null;
