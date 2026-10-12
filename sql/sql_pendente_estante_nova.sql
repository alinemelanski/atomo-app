-- =====================================================================
-- Átomo — Minha estante (visual novo): favoritar, "quero ler" e
-- "última vez que leu" (pra saber qual livro mostrar em "Continuar lendo").
-- Rodar no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- =====================================================================
-- PRA APRENDER: "add column if not exists" só cria a coluna se ela ainda não
-- existir; "default false" faz todos os livros que já estão na estante
-- começarem como "não favorito" e "não está na lista quero ler".
alter table estante_pessoal add column if not exists favorito  boolean not null default false; -- ♡ no card
alter table estante_pessoal add column if not exists quero_ler boolean not null default false; -- 🔖 no card
alter table estante_pessoal add column if not exists lido_em   timestamptz;                    -- o leitor grava toda vez que você lê
-- A RLS da estante_pessoal já existe (cada um só mexe nos próprios livros),
-- então não precisa de policy nova pra essas colunas.
