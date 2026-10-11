-- =====================================================================
-- CORREÇÃO URGENTE: posts dos usuários sumiram do Feed
-- Rodar no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- =====================================================================
--
-- O QUE ACONTECEU (pra aprender):
-- O app busca os posts junto com o autor assim:  posts → usuarios(handle, avatar_url)
-- O Supabase (PostgREST) descobre esse "junto" olhando as chaves estrangeiras.
-- Até ontem só existia UM caminho de posts até usuarios: a coluna posts.autor_id.
--
-- A tabela nova posts_salvos tinha chave estrangeira pros DOIS lados
-- (post_id → posts e usuario_id → usuarios). Isso criou um SEGUNDO caminho:
-- posts → posts_salvos → usuarios ("quem salvou esse post").
-- Com dois caminhos possíveis, o Supabase não sabe qual você quer e devolve
-- erro ("more than one relationship was found") — o Feed recebia erro e
-- ficava parado no carregando, sem os posts.
--
-- A CORREÇÃO: a chave de quem salvou passa a apontar pra auth.users (a tabela
-- de login do Supabase, que fica num esquema que o PostgREST não usa pra
-- montar esses "juntos"). O caminho extra some, e continua valendo a regra de
-- apagar os salvos quando a conta for excluída.

alter table posts_salvos drop constraint if exists posts_salvos_usuario_id_fkey;
alter table posts_salvos
  add constraint posts_salvos_usuario_id_fkey
  foreign key (usuario_id) references auth.users(id) on delete cascade;

-- avisa o PostgREST pra reler as relações na hora (senão ele pode demorar a perceber)
notify pgrst, 'reload schema';
