require('dotenv').config({ path: './servidor.env' });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// mesma URL e chave publicável (anon) que o front-end já usa — não é segredo,
// é protegida por RLS no banco (só permite INSERT na tabela de lista de espera)
const supabase = createClient(
  'https://wfhikucbygmjeawrfsfq.supabase.co',
  'sb_publishable_Sqnu4JCusHeikELanoyPpQ_M0UCLEeP'
);

app.post('/api/lista-espera', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValido) return res.status(400).json({ erro: 'e-mail inválido' });

  const { error } = await supabase.from('lista_espera').insert({ email });

  if (error) {
    if (error.code === '23505') {
      // e-mail já cadastrado — trata como sucesso, não precisa assustar quem tenta de novo
      return res.json({ ok: true, jaCadastrado: true });
    }
    console.log('erro ao inserir na lista de espera:', error.message);
    return res.status(500).json({ erro: 'não consegui salvar seu e-mail, tenta de novo' });
  }

  res.json({ ok: true });
});

console.log('TOKEN CARREGADO:', process.env.TMDB_API_KEY ? process.env.TMDB_API_KEY.slice(0, 20) + '...' : 'VAZIO/UNDEFINED');
console.log('V3 EM JSON:', JSON.stringify(process.env.TMDB_API_KEY_V3));

app.get('/api/buscar-filme', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  const urlCompleta = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY_V3}&query=${encodeURIComponent(termo)}&language=pt-BR`;
  console.log('URL SENDO CHAMADA:', urlCompleta);

  try {
    const resposta = await fetch(urlCompleta);
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar no TMDB' });
  }
});

app.get('/api/filme-trailer', async (req, res) => {
  const filmeId = req.query.id;
  if (!filmeId) return res.status(400).json({ erro: 'faltou o parâmetro id' });

  try {
    const resposta = await fetch(
      `https://api.themoviedb.org/3/movie/${filmeId}/videos?api_key=${process.env.TMDB_API_KEY_V3}&language=pt-BR`
    );
    const dados = await resposta.json();
    const trailer = (dados.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    res.json({ url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null });
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar trailer' });
  }
});

app.get('/api/buscar-musica', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  try {
    const resposta = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(termo)}`);
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar no Deezer' });
  }
});

app.get('/api/buscar-livro', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  try {
    const resposta = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termo)}&key=${process.env.GOOGLE_BOOKS_API_KEY}&maxResults=5`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar no Google Books' });
  }
});

app.get('/api/filmes-em-cartaz', async (req, res) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const resposta = await fetch(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${process.env.TMDB_API_KEY_V3}&language=pt-BR&region=BR&page=${pagina}`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar filmes em cartaz' });
  }
});

app.get('/api/musicas-em-alta', async (req, res) => {
  try {
    const resposta = await fetch('https://api.deezer.com/chart/0/tracks?limit=10');
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar músicas em alta' });
  }
});

function limparHtmlTumblr(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

app.get('/api/tumblr-tag', async (req, res) => {
  const tag = (req.query.tag || '').trim();
  const variar = req.query.variar === 'true';
  if (!tag) return res.status(400).json({ erro: 'faltou o parâmetro tag' });

  try {
    // npf=true força o Tumblr a devolver os posts no formato novo (blocos de
    // conteúdo), que é o que a gente sabe ler abaixo — sem isso, a API manda
    // o formato clássico (campos como "body"/"caption"/"photos"), que ficava
    // de fora do parser e por isso vinha tudo "sem texto"/sem imagem.
    //
    // quando "variar" está ligado (a tela do Descobrir sem busca do usuário),
    // pula pra um ponto aleatório dos últimos 3 dias da tag em vez de sempre
    // pegar o topo — assim a atualização automática/puxar-pra-atualizar não
    // fica sempre mostrando os mesmos posts "congelados".
    let paramBefore = '';
    if (variar) {
      const agora = Math.floor(Date.now() / 1000);
      const janela = 60 * 60 * 24 * 3;
      const before = agora - Math.floor(Math.random() * janela);
      paramBefore = `&before=${before}`;
    }

    const resposta = await fetch(
      `https://api.tumblr.com/v2/tagged?tag=${encodeURIComponent(tag)}&api_key=${process.env.TUMBLR_API_KEY}&limit=30&npf=true${paramBefore}`
    );
    const dados = await resposta.json();
    let postsBrutos = Array.isArray(dados.response) ? dados.response : [];

    // prioriza quem tem mais nota (curtida + reblog), e ainda embaralha um
    // pouco o topo pra não ficar sempre a mesma ordem nos posts mais populares
    postsBrutos = postsBrutos
      .slice()
      .sort((a, b) => (b.note_count || 0) - (a.note_count || 0))
      .slice(0, 15);
    for (let i = postsBrutos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [postsBrutos[i], postsBrutos[j]] = [postsBrutos[j], postsBrutos[i]];
    }

    const posts = postsBrutos.map(p => {
      let texto = '';
      let imagemUrl = null;

      const blocos = Array.isArray(p.content) ? p.content : [];
      blocos.forEach(bloco => {
        if (bloco.type === 'text' && bloco.text) {
          texto += (texto ? '\n' : '') + bloco.text;
        }
        if (bloco.type === 'link') {
          const partes = [bloco.title, bloco.description].filter(Boolean).join(' — ');
          if (partes) texto += (texto ? '\n' : '') + partes;
        }
        if (bloco.type === 'image' && !imagemUrl && Array.isArray(bloco.media) && bloco.media[0]) {
          imagemUrl = bloco.media[0].url;
        }
        if (bloco.type === 'video' && !imagemUrl && bloco.poster && bloco.poster[0]) {
          imagemUrl = bloco.poster[0].url;
        }
      });

      // se por algum motivo esse post não veio no formato novo (ex.: alguns
      // reblogs antigos), tenta ler o formato clássico do Tumblr como reserva
      if (!texto && !imagemUrl) {
        if (p.type === 'text') {
          texto = limparHtmlTumblr(p.body) || limparHtmlTumblr(p.title);
        } else if (p.type === 'photo') {
          texto = limparHtmlTumblr(p.caption);
          if (Array.isArray(p.photos) && p.photos[0] && p.photos[0].original_size) {
            imagemUrl = p.photos[0].original_size.url || null;
          }
        } else if (p.type === 'quote') {
          texto = [p.text, p.source ? limparHtmlTumblr(p.source) : ''].filter(Boolean).join(' — ');
        } else if (p.type === 'link') {
          texto = [p.title, p.description ? limparHtmlTumblr(p.description) : ''].filter(Boolean).join(' — ');
        } else if (p.type === 'chat') {
          texto = limparHtmlTumblr(p.body);
        } else if (p.type === 'video') {
          texto = limparHtmlTumblr(p.caption);
        } else if (p.type === 'answer') {
          texto = [p.question, p.answer].filter(Boolean).join(' — ');
        } else if (p.type === 'audio') {
          texto = limparHtmlTumblr(p.caption);
        }
      }

      return {
        id: p.id,
        blogName: p.blog_name || null,
        texto: texto || 'Sem texto neste post.',
        imagemUrl,
        tags: p.tags || [],
        postUrl: p.post_url || null,
        notas: p.note_count || 0,
      };
    });

    res.json({ posts });
  } catch (erro) {
    console.log('erro Tumblr (tagged):', erro.message);
    res.status(500).json({ erro: 'erro ao buscar no tumblr' });
  }
});

app.get('/api/livros-em-destaque', async (req, res) => {
  // junta 3 fontes de livro numa lista só, cada uma no seu try/catch — se uma
  // cair, as outras continuam aparecendo normal. Todo item vira o mesmo
  // formato { volumeInfo: { title, description } } que o front-end já espera
  // (era o formato nativo da Google Books, agora virou o "padrão" da rota).
  //
  // aceita ?q=termo opcional: sem termo, devolve a lista curada de sempre
  // (ficção recente/popular); com termo, busca esse termo nas 3 fontes e
  // devolve mais resultados por fonte (é uma busca de verdade, não só a
  // vitrine padrão).
  const termo = (req.query.q || '').trim();
  const buscando = termo.length > 0;
  const limite = buscando ? 10 : 5;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const itens = [];

  // Google Books
  try {
    const queryGoogle = buscando ? `q=${encodeURIComponent(termo)}` : 'q=subject:fiction&orderBy=newest';
    const startIndex = (pagina - 1) * limite;
    const resposta = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${queryGoogle}&langRestrict=pt&key=${process.env.GOOGLE_BOOKS_API_KEY}&maxResults=${limite}&startIndex=${startIndex}`
    );
    const dados = await resposta.json();
    (dados.items || []).forEach(l => {
      const capaGoogle = l.volumeInfo?.imageLinks?.thumbnail || l.volumeInfo?.imageLinks?.smallThumbnail || null;
      itens.push({
        fonte: 'Google Books',
        googleId: l.id || null,
        capa: capaGoogle ? capaGoogle.replace('http://', 'https://') : null,
        autor: (l.volumeInfo?.authors || []).join(', '),
        volumeInfo: {
          title: l.volumeInfo?.title || 'Sem título',
          description: l.volumeInfo?.description || 'Sem descrição disponível.',
          link: l.volumeInfo?.infoLink || l.volumeInfo?.previewLink || null,
        },
      });
    });
  } catch (erro) {
    console.log('erro Google Books (livros em destaque):', erro.message);
  }

  // Open Library — sem chave, sem limite de cota, catálogo enorme
  try {
    const queryOpenLibrary = buscando ? `q=${encodeURIComponent(termo)}` : 'q=subject:fiction';
    const resposta = await fetch(
      `https://openlibrary.org/search.json?${queryOpenLibrary}&language=por&limit=${limite}&page=${pagina}`,
      { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
    );
    const dados = await resposta.json();
    (dados.docs || []).forEach(l => {
      const autores = (l.author_name || []).join(', ');
      const ano = l.first_publish_year ? ` (${l.first_publish_year})` : '';
      itens.push({
        fonte: 'Open Library',
        coverId: l.cover_i || null,
        capa: l.cover_i ? `https://covers.openlibrary.org/b/id/${l.cover_i}-L.jpg` : null,
        autor: autores,
        volumeInfo: {
          title: l.title || 'Sem título',
          description: autores ? `${autores}${ano}` : 'Sem descrição disponível.',
          link: l.key ? `https://openlibrary.org${l.key}` : null,
        },
      });
    });
  } catch (erro) {
    console.log('erro Open Library (livros em destaque):', erro.message);
  }

  // Gutendex — Projeto Gutenberg, clássicos de domínio público (a obra continua viva!)
  try {
    const queryGutendex = buscando ? `search=${encodeURIComponent(termo)}` : 'sort=popular';
    const resposta = await fetch(
      `https://gutendex.com/books/?languages=pt&${queryGutendex}&page=${pagina}`,
      { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
    );
    const dados = await resposta.json();
    (dados.results || []).slice(0, limite).forEach(l => {
      const autores = (l.authors || []).map(a => a.name).join(', ');
      itens.push({
        fonte: 'Gutendex',
        gutendexId: l.id || null,
        capa: (l.formats && l.formats['image/jpeg']) || null,
        autor: autores,
        volumeInfo: {
          title: l.title || 'Sem título',
          description: autores ? `${autores} · clássico de domínio público` : 'Clássico de domínio público.',
          link: l.id ? `https://www.gutenberg.org/ebooks/${l.id}` : null,
        },
      });
    });
  } catch (erro) {
    console.log('erro Gutendex (livros em destaque):', erro.message);
  }

  // reforça a prioridade de português: mesmo pedindo só PT nas 3 fontes,
  // o filtro de idioma de cada API (principalmente o langRestrict do
  // Google Books) às vezes deixa passar item em outro idioma. Aqui a
  // gente reordena pra deixar os que claramente parecem PT-BR primeiro,
  // sem descartar os outros (o sort é estável, então dentro de cada grupo
  // a ordem original das fontes continua igual).
  function pareceTextoEmPortugues(texto) {
    if (!texto) return 0;
    const t = ' ' + texto.toLowerCase() + ' ';
    let pontos = 0;
    if (/[ãõáéíóúâêôçü]/.test(t)) pontos += 3;
    ['de ', 'da ', 'do ', 'das ', 'dos ', 'que ', 'não ', 'uma ', 'um ', 'para ', 'com ',
      'história', 'vida', 'amor', 'mundo', 'anos', 'sobre', 'mulher', 'homem', 'livro'
    ].forEach(p => { if (t.includes(' ' + p) || t.includes(p + ' ')) pontos += 1; });
    ['the ', 'and ', 'of the', 'with ', 'a novel', 'love ', 'world ', 'story of', 'life of'
    ].forEach(p => { if (t.includes(p)) pontos -= 1; });
    return pontos;
  }
  itens.sort((a, b) => {
    const scoreA = pareceTextoEmPortugues((a.volumeInfo.title || '') + ' ' + (a.volumeInfo.description || ''));
    const scoreB = pareceTextoEmPortugues((b.volumeInfo.title || '') + ' ' + (b.volumeInfo.description || ''));
    return scoreB - scoreA;
  });

  res.json({ items: itens });
});

app.get('/api/livro-texto', async (req, res) => {
  // pega um trecho de verdade do texto integral de um livro do Gutendex
  // (domínio público) pra mostrar como prévia dentro do próprio app
  const id = (req.query.id || '').trim();
  if (!id) return res.status(400).json({ erro: 'faltou o parâmetro id' });

  try {
    const respLivro = await fetch(`https://gutendex.com/books/${encodeURIComponent(id)}`);
    const livro = await respLivro.json();
    const formatos = livro.formats || {};

    const chaveTxt = Object.keys(formatos).find(k => k.startsWith('text/plain'));
    const chaveHtml = Object.keys(formatos).find(k => k.startsWith('text/html'));
    const urlEscolhida = formatos[chaveTxt] || formatos[chaveHtml];

    if (!urlEscolhida) {
      return res.json({
        titulo: livro.title || 'Sem título',
        autor: (livro.authors || []).map(a => a.name).join(', '),
        texto: 'Prévia não disponível pra este livro.',
      });
    }

    const respTexto = await fetch(urlEscolhida);
    let bruto = await respTexto.text();

    if (!chaveTxt && chaveHtml) {
      bruto = bruto.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    }

    // pula licença/sumário do início do arquivo do Gutenberg e pega um trecho do miolo
    const inicio = Math.min(3000, Math.floor(bruto.length * 0.05));
    const trecho = bruto.slice(inicio, inicio + 6000).trim();

    res.json({
      titulo: livro.title || 'Sem título',
      autor: (livro.authors || []).map(a => a.name).join(', '),
      texto: trecho || 'Prévia não disponível pra este livro.',
    });
  } catch (erro) {
    console.log('erro ao buscar texto do livro (Gutendex):', erro.message);
    res.status(500).json({ erro: 'não consegui carregar a prévia' });
  }
});

app.get('/api/buscar-podcast', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  try {
    const resposta = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(termo)}&entity=podcast&limit=5`);
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar no iTunes' });
  }
});

app.get('/api/podcasts-em-alta', async (req, res) => {
  try {
    const resposta = await fetch('https://itunes.apple.com/search?term=podcast&entity=podcast&limit=5&sort=popularity');
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar podcasts em alta' });
  }
});

app.get('/api/podcast-episodio', async (req, res) => {
  const collectionId = req.query.id;
  if (!collectionId) return res.status(400).json({ erro: 'faltou o parâmetro id' });

  try {
    const resposta = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=podcastEpisode&limit=1`);
    const dados = await resposta.json();
    const episodio = (dados.results || []).find(r => r.episodeUrl);
    res.json({ url: episodio ? episodio.episodeUrl : null });
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar episódio' });
  }
});

app.get('/api/noticias-em-alta', async (req, res) => {
  try {
    const resposta = await fetch(
      `https://gnews.io/api/v4/top-headlines?lang=pt&country=br&max=5&apikey=${process.env.GNEWS_API_KEY}`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar notícias' });
  }
});

app.get('/api/buscar-gif', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  try {
    const resposta = await fetch(
      `https://api.klipy.co/api/v1/${process.env.KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(termo)}&customer_id=atomo-user&per_page=12`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar GIF' });
  }
});

app.get('/api/gifs-em-alta', async (req, res) => {
  try {
    const resposta = await fetch(
      `https://api.klipy.co/api/v1/${process.env.KLIPY_API_KEY}/gifs/trending?customer_id=atomo-user&per_page=30`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar gifs em alta' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));