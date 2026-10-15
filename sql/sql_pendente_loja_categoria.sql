-- =====================================================================
-- Loja de livros: CATEGORIA do livro — rodar no Supabase: SQL Editor > New query > Run
-- A sinopse já existia (coluna "descricao"); só falta a categoria.
-- Editar sinopse/categoria/capa passa pelo servidor (rota /api/estante-autoral/editar),
-- então não precisa liberar UPDATE pro usuário na tabela.
-- =====================================================================
alter table public.livros_autorais add column if not exists categoria text;
