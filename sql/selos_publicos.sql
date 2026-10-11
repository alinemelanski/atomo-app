-- Selos visíveis no perfil de qualquer pessoa (pra quem está logado).
-- Rodar no Supabase > SQL Editor. Pode rodar mais de uma vez sem problema.
drop policy if exists selos_ver_proprios on selos_desbloqueados;
drop policy if exists selos_ver_todos on selos_desbloqueados;
create policy selos_ver_todos on selos_desbloqueados
  for select to authenticated using (true);
-- gravar continua só nos próprios selos (política selos_gravar_proprios não muda)
