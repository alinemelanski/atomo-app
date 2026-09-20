require('dotenv').config({ path: './servidor.env' });
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

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
    const resposta = await fetch(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${process.env.TMDB_API_KEY_V3}&language=pt-BR&region=BR`
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
  const itens = [];

  // Google Books
  try {
    const queryGoogle = buscando ? `q=${encodeURIComponent(termo)}` : 'q=subject:fiction&orderBy=newest';
    const resposta = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${queryGoogle}&langRestrict=pt&key=${process.env.GOOGLE_BOOKS_API_KEY}&maxResults=${limite}`
    );
    const dados = await resposta.json();
    (dados.items || []).forEach(l => {
      itens.push({
        fonte: 'Google Books',
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
      `https://openlibrary.org/search.json?${queryOpenLibrary}&language=por&limit=${limite}`,
      { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
    );
    const dados = await resposta.json();
    (dados.docs || []).forEach(l => {
      const autores = (l.author_name || []).join(', ');
      const ano = l.first_publish_year ? ` (${l.first_publish_year})` : '';
      itens.push({
        fonte: 'Open Library',
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
      `https://gutendex.com/books/?languages=pt&${queryGutendex}`,
      { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
    );
    const dados = await resposta.json();
    (dados.results || []).slice(0, limite).forEach(l => {
      const autores = (l.authors || []).map(a => a.name).join(', ');
      itens.push({
        fonte: 'Gutendex',
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

  res.json({ items: itens });
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