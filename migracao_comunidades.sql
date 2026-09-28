-- ================================================================
-- Comunidades de estudo — migração completa
-- Cole este script inteiro no Supabase: Database > SQL Editor > New query
-- e clique em "Run". Seguro rodar de novo (usa "if not exists").
--
-- Isso é a parte "estudo" das Comunidades (vestibular, concurso, idioma,
-- filosofia etc). O Clube do Livro continua EXATAMENTE como já era
-- (tabelas clubes_livro / clube_membros, sem nenhuma mudança aqui) — ele
-- só passa a aparecer listado JUNTO com essas comunidades novas na aba
-- Comunidades, e isso é 100% front-end, não depende de nada daqui.
-- ================================================================

-- 1) comunidades de estudo
create table if not exists comunidades_estudo (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  categoria text not null default 'geral', -- vestibular | concurso | idioma | filosofia | geral (livre, front-end define as opções)
  criador_id uuid not null references auth.users(id) on delete cascade,
  privada boolean not null default false,
  tema_atual text,        -- o que está "na mesa" agora — aparece no card e na sala
  meta_prazo timestamptz, -- prazo/prova, se quiser mostrar contagem regressiva (opcional)
  criado_em timestamptz not null default now()
);

-- 2) membros de cada comunidade
create table if not exists comunidade_estudo_membros (
  comunidade_id uuid not null references comunidades_estudo(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro', -- 'admin' | 'membro'
  entrou_em timestamptz not null default now(),
  primary key (comunidade_id, usuario_id)
);

-- 3) mural reaproveita a tabela "posts" que já existe — mesma lógica que o
--    Clube do Livro já usa com a coluna clube_id, só soma uma coluna nova
alter table posts add column if not exists comunidade_estudo_id uuid references comunidades_estudo(id) on delete cascade;

-- ---------- RLS (segurança por linha) ----------
alter table comunidades_estudo enable row level security;
alter table comunidade_estudo_membros enable row level security;

drop policy if exists "comunidades visiveis" on comunidades_estudo;
create policy "comunidades visiveis" on comunidades_estudo for select using (
  privada = false or criador_id = auth.uid() or exists (
    select 1 from comunidade_estudo_membros m where m.comunidade_id = id and m.usuario_id = auth.uid()
  )
);

drop policy if exists "comunidades criar" on comunidades_estudo;
create policy "comunidades criar" on comunidades_estudo for insert with check (criador_id = auth.uid());

drop policy if exists "comunidades editar" on comunidades_estudo;
create policy "comunidades editar" on comunidades_estudo for update using (
  criador_id = auth.uid() or exists (
    select 1 from comunidade_estudo_membros m where m.comunidade_id = id and m.usuario_id = auth.uid() and m.papel = 'admin'
  )
);

drop policy if exists "comunidades deletar" on comunidades_estudo;
create policy "comunidades deletar" on comunidades_estudo for delete using (criador_id = auth.uid());

drop policy if exists "membros comunidade visiveis" on comunidade_estudo_membros;
create policy "membros comunidade visiveis" on comunidade_estudo_membros for select using (true);

drop policy if exists "entrar na comunidade" on comunidade_estudo_membros;
create policy "entrar na comunidade" on comunidade_estudo_membros for insert with check (usuario_id = auth.uid());

drop policy if exists "sair da comunidade" on comunidade_estudo_membros;
create policy "sair da comunidade" on comunidade_estudo_membros for delete using (usuario_id = auth.uid());

-- obs: não precisa de policy nova em "posts" pra comunidade_estudo_id —
-- o mural usa privado=false igual o clube do livro já faz (dá pra ver o
-- select "posts visiveis" que já existe hoje, sem mudar nada nele).

-- 28/09: audio no mural do clube e da comunidade (gravar e mandar mensagem
-- de voz, igual já dá pra fazer no chat direto) -- soma coluna nova em
-- "posts" pra guardar a URL do audio gravado
alter table posts add column if not exists audio_url text;

-- 28/09: capa da comunidade, prazo (contagem regressiva) já existia desde
-- o começo (meta_prazo) mas nunca tinha sido usado -- agora tem campo na
-- criação, mostra no card e na tela da comunidade
alter table comunidades_estudo add column if not exists capa_url text;

-- 28/09: admin da comunidade agora consegue promover outro membro a admin
-- e remover gente da comunidade (antes só dava pra cada um sair sozinho)
drop policy if exists "admin promove membros" on comunidade_estudo_membros;
create policy "admin promove membros" on comunidade_estudo_membros for update using (
  exists (
    select 1 from comunidades_estudo c
    where c.id = comunidade_estudo_membros.comunidade_id
      and (
        c.criador_id = auth.uid()
        or exists (
          select 1 from comunidade_estudo_membros m2
          where m2.comunidade_id = comunidade_estudo_membros.comunidade_id
            and m2.usuario_id = auth.uid()
            and m2.papel = 'admin'
        )
      )
  )
) with check (
  exists (
    select 1 from comunidades_estudo c
    where c.id = comunidade_estudo_membros.comunidade_id
      and (
        c.criador_id = auth.uid()
        or exists (
          select 1 from comunidade_estudo_membros m2
          where m2.comunidade_id = comunidade_estudo_membros.comunidade_id
            and m2.usuario_id = auth.uid()
            and m2.papel = 'admin'
        )
      )
  )
);

drop policy if exists "admin remove membros" on comunidade_estudo_membros;
create policy "admin remove membros" on comunidade_estudo_membros for delete using (
  exists (
    select 1 from comunidades_estudo c
    where c.id = comunidade_estudo_membros.comunidade_id
      and (
        c.criador_id = auth.uid()
        or exists (
          select 1 from comunidade_estudo_membros m2
          where m2.comunidade_id = comunidade_estudo_membros.comunidade_id
            and m2.usuario_id = auth.uid()
            and m2.papel = 'admin'
        )
      )
  )
);
