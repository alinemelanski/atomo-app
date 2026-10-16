-- =====================================================================
-- Loja: dedicatória da autora — uma frase curta que aparece
-- na primeira vez que quem comprou abre o livro. Rodar no Supabase (SQL Editor > Run).
-- =====================================================================
alter table public.livros_autorais add column if not exists dedicatoria text;
-- limite de tamanho direto no banco (o app e o servidor também conferem)
alter table public.livros_autorais drop constraint if exists livros_autorais_dedicatoria_tamanho;
alter table public.livros_autorais add constraint livros_autorais_dedicatoria_tamanho check (dedicatoria is null or char_length(dedicatoria) <= 280);
