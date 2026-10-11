-- =====================================================================
-- Átomo — pílula "dias escrevendo" visível no perfil de qualquer pessoa
-- Rodar no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- =====================================================================
--
-- O PROBLEMA
-- O diário é privado: o RLS da tabela "posts" não deixa outra pessoa ler
-- as suas folhas. Isso está certo! Mas pra mostrar "23 dias escrevendo"
-- no seu perfil pra quem te visita, alguém precisa olhar as DATAS das
-- suas folhas. Se o app de quem visita tentasse ler, o RLS bloquearia
-- e a pílula apareceria zerada.
--
-- A SOLUÇÃO: uma função dentro do banco
-- "security definer" = a função roda com a permissão de quem a criou
-- (o dono do banco), não de quem chama. Então ela consegue olhar as datas,
-- mas devolve SÓ um número. Quem visita nunca recebe texto, data ou id de
-- folha nenhuma — só o "23".
--
-- A REGRA (igual à do app, em js/sequencia-selos.js → calcularStreakReal):
--  - conta como dia escrito: qualquer post (diário, Feed, mural) ou comentário;
--    mensagem de DM NÃO conta;
--  - dias seguidos a partir de hoje (ou de ontem: a sequência não zera antes
--    de a pessoa ter tido a chance de escrever hoje);
--  - "uma chance": 1 dia em branco é perdoado, e a chance só volta depois
--    de 7 dias escritos. Dois dias seguidos em branco zeram.
--  - o dia é contado no horário de Brasília (senão uma folha das 22h
--    contaria como do dia seguinte, que é como o banco guarda em UTC).

create or replace function public.dias_escrevendo(p_usuario uuid)
returns integer
language plpgsql
stable                      -- só lê, não altera nada
security definer
set search_path = public    -- boa prática de segurança em funções security definer
as $$
declare
  dias         date[];      -- lista de dias com escrita, do mais novo pro mais antigo
  hoje         date := (now() at time zone 'America/Sao_Paulo')::date;
  atraso       int;
  sequencia    int := 1;
  desde_chance int := 7;    -- 7 = a chance está disponível
  diferenca    int;
begin
  select array_agg(dia order by dia desc) into dias
  from (
    select (criado_em at time zone 'America/Sao_Paulo')::date as dia from posts where autor_id = p_usuario
    union  -- "union" (sem "all") já tira os dias repetidos
    select (criado_em at time zone 'America/Sao_Paulo')::date from comentarios where autor_id = p_usuario
  ) escritas;

  if dias is null then return 0; end if;

  atraso := hoje - dias[1];          -- 0 = escreveu hoje, 1 = ontem, 2 = ontem ficou em branco
  if atraso > 2 then return 0; end if;
  if atraso = 2 then desde_chance := 0; end if;  -- gastou a chance com o dia de ontem

  for i in 1 .. coalesce(array_length(dias, 1), 1) - 1 loop
    diferenca := dias[i] - dias[i + 1];
    if diferenca = 1 then
      sequencia := sequencia + 1; desde_chance := desde_chance + 1;
    elsif diferenca = 2 and desde_chance >= 7 then
      sequencia := sequencia + 1; desde_chance := 0;
    else
      exit;  -- buraco maior: a sequência acaba aqui
    end if;
  end loop;

  return sequencia;
end;
$$;

-- só quem está logado pode chamar (visitante anônimo, não)
revoke all on function public.dias_escrevendo(uuid) from public;
grant execute on function public.dias_escrevendo(uuid) to authenticated;
