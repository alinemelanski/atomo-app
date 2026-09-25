-- ================================================================
-- Clube do Livro — migração completa
-- Cole este script inteiro no Supabase: Database > SQL Editor > New query
-- e clique em "Run". Pode rodar tudo de uma vez, é seguro repetir
-- (usa "if not exists" / "on conflict do nothing" onde faz sentido).
-- ================================================================

-- 1) clubes de livro
create table if not exists clubes_livro (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  criador_id uuid not null references auth.users(id) on delete cascade,
  privado boolean not null default false,
  livro_titulo text,
  livro_autor text,
  livro_capa_url text,
  livro_google_id text,
  criado_em timestamptz not null default now()
);

-- 2) membros de cada clube
create table if not exists clube_membros (
  clube_id uuid not null references clubes_livro(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro', -- 'admin' | 'membro'
  entrou_em timestamptz not null default now(),
  primary key (clube_id, usuario_id)
);

-- 3) discussão do clube reaproveita a tabela "posts" que já existe,
--    só adiciona uma coluna pra marcar que aquele post é de um clube
alter table posts add column if not exists clube_id uuid references clubes_livro(id) on delete cascade;

-- 4) estante pessoal (epubs enviados por cada pessoa, leitura privada)
create table if not exists estante_pessoal (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  autor text,
  capa_url text,
  arquivo_path text not null,
  formato text not null default 'epub',
  progresso_percentual numeric not null default 0,
  ultima_posicao text,
  adicionado_em timestamptz not null default now()
);

-- ---------- RLS (segurança por linha) ----------
alter table clubes_livro enable row level security;
alter table clube_membros enable row level security;
alter table estante_pessoal enable row level security;

drop policy if exists "clubes visiveis" on clubes_livro;
create policy "clubes visiveis" on clubes_livro for select using (
  privado = false or criador_id = auth.uid() or exists (
    select 1 from clube_membros m where m.clube_id = id and m.usuario_id = auth.uid()
  )
);

drop policy if exists "clubes criar" on clubes_livro;
create policy "clubes criar" on clubes_livro for insert with check (criador_id = auth.uid());

drop policy if exists "clubes editar" on clubes_livro;
create policy "clubes editar" on clubes_livro for update using (
  criador_id = auth.uid() or exists (
    select 1 from clube_membros m where m.clube_id = id and m.usuario_id = auth.uid() and m.papel = 'admin'
  )
);

drop policy if exists "clubes deletar" on clubes_livro;
create policy "clubes deletar" on clubes_livro for delete using (criador_id = auth.uid());

drop policy if exists "membros visiveis" on clube_membros;
create policy "membros visiveis" on clube_membros for select using (true);

drop policy if exists "entrar no clube" on clube_membros;
create policy "entrar no clube" on clube_membros for insert with check (usuario_id = auth.uid());

drop policy if exists "sair do clube" on clube_membros;
create policy "sair do clube" on clube_membros for delete using (usuario_id = auth.uid());

drop policy if exists "estante propria" on estante_pessoal;
create policy "estante propria" on estante_pessoal for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ---------- storage: bucket privado pra estante (epub) ----------
insert into storage.buckets (id, name, public)
values ('estante-epubs', 'estante-epubs', false)
on conflict (id) do nothing;

drop policy if exists "estante epub select propria" on storage.objects;
create policy "estante epub select propria" on storage.objects for select using (
  bucket_id = 'estante-epubs' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "estante epub insert propria" on storage.objects;
create policy "estante epub insert propria" on storage.objects for insert with check (
  bucket_id = 'estante-epubs' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "estante epub delete propria" on storage.objects;
create policy "estante epub delete propria" on storage.objects for delete using (
  bucket_id = 'estante-epubs' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ================================================================
-- Ferramentas do clube: roleta do próximo livro
-- ================================================================

-- 5) sugestões de livro pra roleta (qualquer membro sugere, o clube sorteia)
create table if not exists clube_sugestoes_livro (
  id uuid primary key default gen_random_uuid(),
  clube_id uuid not null references clubes_livro(id) on delete cascade,
  sugerido_por uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  autor text,
  capa_url text,
  google_id text,
  criado_em timestamptz not null default now()
);

alter table clube_sugestoes_livro enable row level security;

drop policy if exists "sugestoes visiveis pros membros" on clube_sugestoes_livro;
create policy "sugestoes visiveis pros membros" on clube_sugestoes_livro for select using (
  exists (select 1 from clube_membros m where m.clube_id = clube_sugestoes_livro.clube_id and m.usuario_id = auth.uid())
);

drop policy if exists "sugerir livro" on clube_sugestoes_livro;
create policy "sugerir livro" on clube_sugestoes_livro for insert with check (
  sugerido_por = auth.uid() and exists (select 1 from clube_membros m where m.clube_id = clube_sugestoes_livro.clube_id and m.usuario_id = auth.uid())
);

drop policy if exists "remover sugestao" on clube_sugestoes_livro;
create policy "remover sugestao" on clube_sugestoes_livro for delete using (
  sugerido_por = auth.uid() or exists (
    select 1 from clube_membros m where m.clube_id = clube_sugestoes_livro.clube_id and m.usuario_id = auth.uid() and m.papel = 'admin'
  ) or exists (
    select 1 from clubes_livro cl where cl.id = clube_sugestoes_livro.clube_id and cl.criador_id = auth.uid()
  )
);

-- ================================================================
-- Inspirado no Fable: sequência de leitura, salas por capítulo,
-- aviso de spoiler
-- ================================================================

-- 6) um registro por dia que a pessoa leu alguma coisa (streak)
create table if not exists logs_leitura (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  criado_em timestamptz not null default now(),
  unique (usuario_id, data)
);
alter table logs_leitura enable row level security;

drop policy if exists "leitura propria" on logs_leitura;
create policy "leitura propria" on logs_leitura for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 7) discussão do clube: sala por capítulo (texto livre, opcional) + aviso de spoiler
alter table posts add column if not exists capitulo_livro text;
alter table posts add column if not exists tem_spoiler boolean not null default false;

-- 8) data em que um livro da estante foi marcado como terminado (pro resumo de leitura)
alter table estante_pessoal add column if not exists finalizado_em timestamptz;

-- ================================================================
-- Estatísticas de leitura (páginas + horas), grifos e cartão externo
-- ================================================================

-- 9) estatísticas de leitura por usuário — acumulado ao longo da vida
create table if not exists estatisticas_leitura (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  paginas_lidas integer not null default 0,
  minutos_leitura integer not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table estatisticas_leitura enable row level security;

drop policy if exists "estatisticas proprias" on estatisticas_leitura;
create policy "estatisticas proprias" on estatisticas_leitura for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

grant select on public.estatisticas_leitura to anon;
grant select, insert, update, delete on public.estatisticas_leitura to authenticated;
grant select, insert, update, delete on public.estatisticas_leitura to service_role;

-- 10) maior página já alcançada em cada livro (evita contar 2x ao voltar/reler)
alter table estante_pessoal add column if not exists pagina_max_alcancada integer not null default 0;

-- 11) grifos: trechos marcados durante a leitura, viram cartão de citação compartilhável
create table if not exists grifos_livro (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  estante_id uuid references estante_pessoal(id) on delete cascade,
  livro_titulo text not null,
  livro_autor text,
  texto text not null,
  criado_em timestamptz not null default now()
);
alter table grifos_livro enable row level security;

drop policy if exists "grifos proprios" on grifos_livro;
create policy "grifos proprios" on grifos_livro for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

grant select on public.grifos_livro to anon;
grant select, insert, update, delete on public.grifos_livro to authenticated;
grant select, insert, update, delete on public.grifos_livro to service_role;

-- 12) marca de "lida" nas mensagens da DM — usada pro sticker/badge de não lida
-- na aba Mensagens e pra saber o que já foi visto quando a conversa é reaberta.
-- Tabela mensagens já existe (não é nova), então não precisa de GRANT novo.
alter table mensagens add column if not exists lida boolean not null default false;
