-- Tema Clima: novo campo pra guardar se o usuário ativou o tema dinâmico de clima
alter table usuarios add column if not exists tema_clima boolean default false;
