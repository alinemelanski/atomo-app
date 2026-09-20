require('dotenv').config({ path: './servidor.env' });

async function testarTMDB() {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY_V3}&query=matrix`;
  console.log('Testando:', url);

  const resposta = await fetch(url);
  const dados = await resposta.json();
  console.log(dados);
}

testarTMDB();