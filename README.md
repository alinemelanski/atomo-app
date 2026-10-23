# Átomo

> seu diário tem visitas.

O **Átomo** é um app brasileiro que incentiva a leitura e a escrita: diário pessoal, estante de livros, leitor embutido com livros gratuitos em português, clubes do livro, comunidades de estudo e mensagens entre amigos. Funciona como PWA (instala direto do navegador) e está sendo preparado para a Play Store.

Criado e mantido por **Aline Melanski**.

## O que tem no app

- **Diário (Anotações):** folhas de papel com data e assinatura, deslizando como um bloco de notas; exportação em PDF; lembranças "neste dia".
- **Perfil e Feed:** posts, curtidas, comentários, menções (`@pessoa`), tópicos e a sequência de dias escrevendo, com selos colecionáveis.
- **Livros:** estante pessoal, leitor com paginação estilo Kindle, grifos com nota e marcador de página, livros gratuitos de domínio público (Gutenberg, Open Library, Wikisource) e Estante Autoral para autores independentes.
- **Clube do livro e comunidades de estudo:** mural, ranking de leitura, convites por link e sala de estudo ao vivo com áudio.
- **Mensagens:** conversas entre amigos, com indicador de "digitando…", fixar e apagar conversas.
- **Seu dia:** resumo gentil que aparece à noite, perto do horário de dormir de cada pessoa, com observações e conselhos do dia.
- **Notificações push** personalizadas (bom dia, reflexão da noite, lembretes).
- **Temas:** claro, escuro e Tema Clima (muda conforme o tempo, a hora e a estação).
- **Idiomas:** português e inglês.

## Tecnologias

| Camada | O que usa |
|---|---|
| Front-end | HTML, CSS e JavaScript puro (sem framework), PWA com service worker |
| Back-end | Node.js + Express (`servidor.js`) |
| Banco, login e arquivos | Supabase (Postgres, Auth, Storage, Realtime) |
| Notificações | Web Push |
| Hospedagem | Front estático + API no Render |

## Estrutura do projeto

| Pasta / arquivo | O que tem |
|---|---|
| `index.html` | Estrutura das telas e dos popups |
| `css/` | Visual, um arquivo por área |
| `js/` | Lógica do app, um arquivo por área |
| `servidor.js` | API (livros, push, e-mail, rádio, clima e mais) |
| `sql/` | Scripts para rodar no Supabase |
| `tests/` | Scripts de teste manual |
| `sw.js` | Service worker (cache offline) |
| `manifest.json`, `icons/`, `selos/` | Instalação do app, ícones e imagens dos selos |

Há um mapa mais detalhado, com o passo a passo de criar arquivos novos, em [`LEIAME.md`](LEIAME.md).

## Rodando no seu computador

Você precisa do [Node.js](https://nodejs.org) instalado.

```bash
# 1. baixe o projeto
git clone https://github.com/alinemelanski/atomo-app.git
cd atomo-app

# 2. instale as dependências
npm install

# 3. crie o arquivo servidor.env (veja a seção abaixo)

# 4. ligue a API (porta 3001) e o front (porta 3000) juntos
npm run dev
```

Depois abra **http://localhost:3000**. Quando o app roda em `localhost`, ele conversa sozinho com a API local; fora dele, usa a API publicada.

Se preferir ligar separado: `npm start` para a API e `npx serve -l 3000` para o front.

## Chaves e segredos

O arquivo `servidor.env` **nunca vai para o GitHub** (está no `.gitignore`). Ele guarda as chaves do Supabase, das notificações push e dos serviços externos usados pelo `servidor.js` (procure por `process.env` nesse arquivo para ver todos os nomes). Alguns exemplos:

- `ADMIN_SECRET`: senha do painel `metricas.html`
- `DAILY_API_KEY`: sala de estudo com áudio

No Render, as mesmas variáveis ficam em **Environment**.

A chave `sb_publishable_...` do Supabase, que aparece no front, é pública por definição: quem protege os dados são as regras de acesso (RLS) do banco.

## Banco de dados

Os scripts em `sql/` criam tabelas, colunas e regras de acesso no Supabase. Rode no **SQL Editor** do Supabase os que ainda não foram rodados; eles são seguros para rodar de novo.

## Publicação

- **Front-end e API:** cada `git push origin main` publica o front. Mudanças no `servidor.js` precisam de um novo deploy da API no Render.
- **Service worker:** ao mexer em arquivos de `css/` ou `js/`, aumente o `CACHE_NAME` em `sw.js`, senão quem já abriu o app continua vendo a versão antiga guardada.
- **Play Store:** o app é empacotado como TWA, que abre o site publicado dentro de um app Android.

## Versão

O app segue versionamento semântico: `0.9.x` até o lançamento e `1.0.0` no dia da estreia na Play Store. A versão atual aparece em Configurações.

## Contato

- GitHub: [@alinemelanski](https://github.com/alinemelanski)
- LinkedIn: [Aline Melanski](https://www.linkedin.com/in/aline-melanski-840a65113)
