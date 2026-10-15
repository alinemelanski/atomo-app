-- =====================================================================
-- Fundo (tema) da conversa — rodar no Supabase: SQL Editor > New query > Run
--
-- POR QUE ISSO É NECESSÁRIO:
-- O app mandava um UPDATE direto na tabela conversas. Sem uma regra (RLS)
-- que permita UPDATE, o Supabase não dá erro: ele só atualiza ZERO linhas,
-- em silêncio. Por isso o fundo mudava na tela, mas não ficava salvo.
--
-- Em vez de liberar UPDATE em qualquer coluna da conversa (aí alguém poderia
-- mexer em usuario1_id/usuario2_id), criamos uma função que só sabe fazer
-- UMA coisa: trocar o tema_cor, e só se quem pediu participa da conversa.
-- "security definer" = a função roda com permissão do dono do banco, mas
-- a gente mesmo confere o auth.uid() lá dentro.
-- =====================================================================

alter table public.conversas add column if not exists tema_cor text;

create or replace function public.definir_tema_conversa(p_conversa uuid, p_tema text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- aceita vazio (= "Do app"), nomes de tema (só letras minúsculas) ou cor antiga (#RRGGBB)
  if p_tema is not null and p_tema !~ '^([a-z]{1,20}|#[0-9A-Fa-f]{6})$' then
    raise exception 'tema inválido';
  end if;

  update conversas
     set tema_cor = nullif(p_tema, '')
   where id = p_conversa
     and auth.uid() in (usuario1_id, usuario2_id);

  return found; -- true se salvou, false se a conversa não é sua
end;
$$;

grant execute on function public.definir_tema_conversa(uuid, text) to authenticated;
