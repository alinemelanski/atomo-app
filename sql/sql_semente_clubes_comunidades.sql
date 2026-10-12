-- =====================================================================
-- Átomo — clubes e comunidades de TESTE (semente)
-- Rodar no SQL Editor do Supabase. Pode rodar mais de uma vez: só cria
-- o que ainda não existe com o mesmo nome.
-- =====================================================================
--
-- COMO FUNCIONA (pra aprender):
-- - "with eu as (...)" é uma CTE: uma "tabela temporária" que existe só
--   dentro do comando. Aqui ela guarda o SEU id, achado pelo seu e-mail de
--   login, pra você ser a criadora e a admin de tudo.
-- - "where not exists (...)" impede criar duplicado se rodar de novo.
-- - Depois de criar cada grupo, você entra nele como admin
--   (as tabelas clube_membros / comunidade_estudo_membros).

-- ---------- PRÉ-REQUISITO: coluna do cronômetro ----------
-- O app (comunidades.js) lê e grava "temporizador_ativo" pra ligar/desligar
-- a contagem regressiva, mas essa coluna nunca foi criada no banco.
-- Sem ela, salvar o prazo de uma comunidade dá erro. "default true" =
-- toda comunidade com prazo já mostra a contagem.
alter table comunidades_estudo add column if not exists temporizador_ativo boolean not null default true;

-- ---------- 3 CLUBES DO LIVRO (categorias diferentes) ----------
with eu as (select id from auth.users where email = 'alinemelanski10@gmail.com'),
novos as (
  insert into clubes_livro (nome, descricao, criador_id, privado, livro_titulo, livro_autor, capitulo_atual)
  select v.nome, v.descricao, eu.id, false, v.livro, v.autor, v.cap
  from eu, (values
    ('Clássicos Brasileiros', 'Lendo os grandes da nossa literatura, um capítulo por semana. Capitu traiu ou não traiu?', 'Dom Casmurro', 'Machado de Assis', 'cap. 1'),
    ('Fábulas e Política', 'Livros curtos que dizem muito sobre poder, sociedade e liberdade.', 'A Revolução dos Bichos', 'George Orwell', 'cap. 1'),
    ('Romance Contemporâneo', 'Ficção brasileira recente, pra discutir o Brasil de hoje através das histórias.', 'Torto Arado', 'Itamar Vieira Junior', 'cap. 1')
  ) as v(nome, descricao, livro, autor, cap)
  where not exists (select 1 from clubes_livro c where c.nome = v.nome)
  returning id, criador_id
)
insert into clube_membros (clube_id, usuario_id, papel)
select id, criador_id, 'admin' from novos;

-- ---------- 3 COMUNIDADES DE ESTUDO ----------
-- O ENEM 2026 é em 8 e 15 de novembro de 2026 (fonte: edital do Inep).
-- A contagem regressiva usa o primeiro dia, às 13h30 de Brasília (abertura dos portões é antes, mas a prova começa nesse horário).
with eu as (select id from auth.users where email = 'alinemelanski10@gmail.com'),
novas as (
  insert into comunidades_estudo (titulo, descricao, categoria, criador_id, privada, tema_atual, meta_prazo)
  select v.titulo, v.descricao, v.categoria, eu.id, false, v.tema, v.prazo
  from eu, (values
    ('ENEM 2026', 'Reta final pro ENEM: redação, simulados e revisão juntos. Provas em 8 e 15 de novembro.', 'vestibular', 'redação: repertório sociocultural', '2026-11-08 13:30:00-03'::timestamptz),
    ('Concursos Públicos', 'Português, raciocínio lógico e legislação pra quem estuda pra concurso. Cada um no seu edital, todos no mesmo ritmo.', 'concurso', 'português: crase e regência', null::timestamptz),
    ('Inglês do Zero ao Fluente', 'Pra quem quer ler livros em inglês no original. Vocabulário, leitura guiada e conversação.', 'idioma', 'phrasal verbs do dia a dia', null::timestamptz)
  ) as v(titulo, descricao, categoria, tema, prazo)
  where not exists (select 1 from comunidades_estudo c where c.titulo = v.titulo)
  returning id, criador_id
)
insert into comunidade_estudo_membros (comunidade_id, usuario_id, papel)
select id, criador_id, 'admin' from novas;
