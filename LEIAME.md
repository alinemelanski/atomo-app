# Átomo — mapa do projeto

Onde mexer em cada coisa:

| Pasta / arquivo | O que tem |
|---|---|
| `index.html` | Só a estrutura (telas, popups). Sem CSS nem JS dentro. |
| `css/` | Visual, um arquivo por área (`feed.css`, `perfil.css`, `clubes.css`...). A ordem dos `<link>` no `<head>` importa. |
| `js/` | Lógica do app, um arquivo por área (`feed.js`, `comentarios.js`, `clubes.js`, `leitor.js`, `mensagens.js`...). A ordem dos `<script>` no fim do `index.html` importa; `init.js` roda por último. |
| `servidor.js` | Backend (Express, roda no Render): livros, push, e-mail, rádio etc. |
| `sql/` | Scripts SQL pra rodar no Supabase (migrações e pendências). |
| `tests/` | Scripts de teste manual. Rodar da raiz: `node tests/conectar.js` (veja `tests/LEIAME.md`). |
| `sw.js` | Service worker. Ao criar um arquivo novo em `css/` ou `js/`, inclua na lista `STATIC_ASSETS` e aumente o `CACHE_NAME`. |
| `manifest.json`, `icons/`, `selos/` | Instalação do app, ícones e imagens dos selos. |
| `termos.html`, `metricas.html` | Páginas avulsas. |

## Segredos
Chaves e senhas ficam só em `.env` / `servidor.env` (ignorados pelo git) e nas variáveis de ambiente do Render.
A chave `sb_publishable_...` do Supabase é pública por definição (quem protege os dados são as regras RLS).

## Criando um arquivo novo de JS
1. Crie `js/nome.js` (script comum, sem `import`/`export`: tudo é compartilhado entre os arquivos).
2. Adicione `<script src="js/nome.js"></script>` no `index.html`, antes de `js/init.js`.
3. Adicione `./js/nome.js` no `STATIC_ASSETS` do `sw.js` e aumente `CACHE_NAME`.
