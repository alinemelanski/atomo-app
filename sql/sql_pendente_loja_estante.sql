-- =====================================================================
-- Loja → Estante: livro comprado vai direto pra estante, liberado pra ler no app
-- (nada de baixar arquivo). Rodar no Supabase: SQL Editor > New query > Run.
-- =====================================================================
-- qual livro da Loja aquela linha da estante é (vazio = epub que a pessoa subiu)
alter table public.estante_pessoal add column if not exists livro_autoral_id bigint;
-- a mesma pessoa não ganha o mesmo livro duas vezes na estante
create unique index if not exists estante_pessoal_livro_autoral_unico
  on public.estante_pessoal (usuario_id, livro_autoral_id) where livro_autoral_id is not null;
