-- =====================================================================
-- Notificações de CLUBE e COMUNIDADE — rodar no Supabase: SQL Editor > New query > Run
-- grupo_id guarda de qual clube/comunidade veio o aviso, pra que tocar na
-- notificação abra o grupo certo. Texto (e não número) pra servir pros dois tipos.
-- Sem esta coluna os avisos continuam chegando; só abrem a aba em vez do grupo.
-- =====================================================================
alter table public.notificacoes add column if not exists grupo_id text;
