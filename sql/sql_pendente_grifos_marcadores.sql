-- =====================================================================
-- Grifos coloridos, nota no grifo e marcadores de página — rodar no Supabase:
-- SQL Editor > New query > Run. Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- 1) grifos (a tabela já existe): cor, nota e ONDE o trecho está no livro
alter table public.grifos_livro add column if not exists cor text;          -- amarelo | salvia | terracota | lilas
alter table public.grifos_livro add column if not exists nota text;         -- comentário curtinho da pessoa
alter table public.grifos_livro add column if not exists cfi text;          -- posição exata no epub
alter table public.grifos_livro add column if not exists pagina integer;    -- página no leitor de texto (livros grátis)
alter table public.grifos_livro add column if not exists livro_chave text;  -- qual livro grátis (ex.: gutendex:1342)

-- 2) marcadores de página
create table if not exists public.marcadores_livro (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  estante_id uuid references public.estante_pessoal(id) on delete cascade, -- epub da estante
  livro_chave text,                                                         -- ou livro grátis
  livro_titulo text,
  posicao text not null,  -- cfi (epub) ou número da página (texto)
  rotulo text,            -- o que aparece na lista: "pág. 12" ou "45%"
  criado_em timestamptz not null default now()
);
alter table public.marcadores_livro enable row level security;
-- cada pessoa só vê e mexe nos próprios marcadores
drop policy if exists "marcadores proprios" on public.marcadores_livro;
create policy "marcadores proprios" on public.marcadores_livro
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
grant select, insert, update, delete on public.marcadores_livro to authenticated;
grant select, insert, update, delete on public.marcadores_livro to service_role;
