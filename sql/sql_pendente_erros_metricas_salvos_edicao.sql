-- =====================================================================
-- Átomo — registro de erros, métricas de uso, salvar post e editar post
-- Rodar no SQL Editor do Supabase. Pode rodar mais de uma vez
-- (tudo usa "if not exists" / "drop policy if exists").
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) REGISTRO DE ERROS
-- ---------------------------------------------------------------------
-- Por quê: quando algo quebra no celular de alguém (ex: "tabela não existe"),
-- o erro só aparecia no Console daquele navegador — você nunca ficava sabendo.
-- Agora o app manda o erro pro servidor.js (rota /api/erros), e o servidor
-- grava aqui. Você vê tudo no painel metricas.html.

create table if not exists erros_app (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  usuario_id  uuid references usuarios(id) on delete set null, -- quem estava logado (pode ficar vazio)
  mensagem    text not null,          -- ex: "relation humor_diario does not exist"
  pilha       text,                   -- o "stack trace": em qual arquivo/linha aconteceu
  tela        text,                   -- em qual tela a pessoa estava
  origem      text,                   -- "front" (navegador) ou "back" (servidor.js)
  navegador   text,                   -- ajuda a saber se o erro é só no iPhone, por ex.
  resolvido   boolean not null default false  -- vira true quando você marca como resolvido no painel
);

-- índice: deixa rápido listar "os erros mais recentes ainda não resolvidos"
create index if not exists erros_app_recentes on erros_app (resolvido, criado_em desc);

-- RLS ligado e SEM nenhuma policy, de propósito: ninguém lê nem grava pelo
-- navegador. Só o servidor.js consegue (ele usa a chave service_role, que
-- ignora o RLS). Assim ninguém enche a tabela de lixo nem lê erro dos outros.
alter table erros_app enable row level security;


-- ---------------------------------------------------------------------
-- 2) MÉTRICAS DE USO (quem abriu o app, quem leu, por dia)
-- ---------------------------------------------------------------------
-- Uma linha = "fulano fez X neste dia". A chave única (usuario_id, tipo, dia)
-- faz cada pessoa contar no máximo UMA vez por dia em cada tipo — então
-- abrir o app 30 vezes no mesmo dia continua sendo 1 "ativo hoje".

create table if not exists eventos_app (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo       text not null,   -- 'abriu_app', 'leu', ...
  dia        date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  criado_em  timestamptz not null default now(),
  primary key (usuario_id, tipo, dia)
);

alter table eventos_app enable row level security;

-- cada pessoa só pode registrar evento em nome dela mesma; ninguém lê pelo app
-- (quem lê é o painel de métricas, pelo servidor)
drop policy if exists "registrar meu evento" on eventos_app;
create policy "registrar meu evento" on eventos_app
  for insert with check (auth.uid() = usuario_id);


-- ---------------------------------------------------------------------
-- 3) SALVAR (FAVORITAR) POST
-- ---------------------------------------------------------------------
-- Tabela separada (e não uma coluna em "posts") porque MUITAS pessoas podem
-- salvar o MESMO post — é a mesma lógica da tabela "curtidas".
-- post_id é bigint porque o id dos posts é número (não uuid).

create table if not exists posts_salvos (
  -- ATENÇÃO: aponta pra auth.users, NÃO pra usuarios. Se apontasse pra usuarios,
  -- o Supabase passaria a ver dois caminhos entre posts e usuarios e o Feed quebraria
  -- (explicação completa em sql_correcao_feed_posts_salvos.sql)
  usuario_id  uuid   not null references auth.users(id) on delete cascade,
  post_id     bigint not null references posts(id)       on delete cascade,
  salvo_em    timestamptz not null default now(),
  primary key (usuario_id, post_id)  -- impede salvar o mesmo post 2x
);

alter table posts_salvos enable row level security;

-- salvos são PRIVADOS: cada um só vê, cria e apaga os próprios
drop policy if exists "ver meus salvos" on posts_salvos;
create policy "ver meus salvos" on posts_salvos
  for select using (auth.uid() = usuario_id);

drop policy if exists "salvar post" on posts_salvos;
create policy "salvar post" on posts_salvos
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "remover salvo" on posts_salvos;
create policy "remover salvo" on posts_salvos
  for delete using (auth.uid() = usuario_id);


-- ---------------------------------------------------------------------
-- 4) EDITAR POST
-- ---------------------------------------------------------------------
-- A tabela "posts" já deixa o dono alterar o próprio post (policy de UPDATE
-- criada no "fixar post"). Só falta guardar QUANDO foi editado, pra mostrar
-- "(editado)" no card, igual ao Twitter — quem leu antes sabe que mudou.

alter table posts add column if not exists editado_em timestamptz;


-- ---------------------------------------------------------------------
-- 5) IDIOMA DOS LIVROS DA ESTANTE AUTORAL (PT / EN)
-- ---------------------------------------------------------------------
-- O autor diz em que idioma o livro está, e a estante mostra a etiqueta.
-- O "do $$ ... $$" só acrescenta a coluna SE a tabela livros_autorais já
-- existir (ela vem do sql_pendente_estante_autoral.sql) — assim este arquivo
-- não quebra se você ainda não rodou aquele.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'livros_autorais') then
    alter table livros_autorais add column if not exists idioma text not null default 'pt';
  end if;
end $$;
