-- ============================================================
-- SQL PENDENTE DO ÁTOMO — guardar os selos conquistados no perfil
-- Cole tudo de uma vez no Supabase: Database > SQL Editor > New query > Run
-- Seguro rodar de novo (só cria o que ainda não existe)
-- ============================================================

create table if not exists selos_desbloqueados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  selo_numero int not null,
  criado_em timestamptz not null default now(),
  unique (usuario_id, selo_numero)
);

alter table selos_desbloqueados enable row level security;

-- cada pessoa vê e grava só os próprios selos
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'selos_desbloqueados' and policyname = 'selos_ver_proprios') then
    create policy selos_ver_proprios on selos_desbloqueados for select using (auth.uid() = usuario_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'selos_desbloqueados' and policyname = 'selos_gravar_proprios') then
    create policy selos_gravar_proprios on selos_desbloqueados for insert with check (auth.uid() = usuario_id);
  end if;
end $$;
