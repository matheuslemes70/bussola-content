# Banco de dados da Bússola

Os arquivos em `migrations/` são rodados **à mão, em ordem**, no SQL Editor do
Supabase (o Supabase CLI não está instalado). Depois de rodar um arquivo novo,
anote aqui na tabela.

| Arquivo | O que faz | Rodado em produção |
| --- | --- | --- |
| 0001 a 0019 | Estrutura original até a data de entrega | sim |
| 0015_executor_obrigatorio e 0015_financeiro | Dois arquivos com o mesmo número; os dois foram rodados | sim |
| 0020_fase1 | Permissões alinhadas (Gestora de Projetos, criação de posts, financeiro) e links de referência recuperados | sim (23/10/2026) |
| 0021_revisao_interna | Etapa "Revisão interna" | sim (23/10/2026) |
| 0022_agendado | Etapa "Agendado" | sim (23/10/2026) |
| 0023_rotina_semanal | Rotina semanal de posts por cliente | sim (26/10/2026) |
| 0024_rotina_turno | Turno (manhã, tarde, noite) na rotina | — |

## Criado direto no Supabase (fora dos arquivos)

- **Tabela `todos`** (tela Tarefas): colunas usadas pelo código são `id`,
  `user_id`, `texto`, `feita`, `data` e `created_at`. Se um dia for preciso
  recriar o banco do zero, ela precisa ser criada à parte, com uma regra que
  deixe cada pessoa ver só as próprias tarefas.

## Regra para mudanças novas

1. Toda mudança no banco vira um arquivo novo aqui, com o próximo número.
2. Nunca alterar regras de acesso direto no painel do Supabase sem criar o
   arquivo correspondente. Senão o código e o banco voltam a divergir.
