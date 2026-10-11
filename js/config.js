/* js/config.js — Configuração (endereço do servidor) e convites por link na URL
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// endereço do servidor próprio (servidor.js) — troca só essa linha quando ele
// for pro ar de verdade (Render, Railway, etc.). Em localhost continua igual.
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : 'https://atomo-app.onrender.com'; // servidor.js rodando no Render

// ---------- convite de clube por link (?clube=<id> na URL) ----------
// guarda no localStorage (sobrevive a reload e a trocar de aba, ex: confirmar
// e-mail de cadastro) e limpa a URL pra ficar bonitinha
(function guardarConviteClubeDaUrl() {
  const params = new URLSearchParams(location.search);
  const idConvite = params.get('clube');
  if (idConvite) {
    localStorage.setItem('atomoConviteClube', JSON.stringify({ id: idConvite, quando: Date.now() }));
    params.delete('clube');
    const novaUrl = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
    history.replaceState(null, '', novaUrl);
  }
})();

// ---------- convite de comunidade de estudo por link (?comunidade=<id>) ----------
// mesmo padrão do convite de clube acima
(function guardarConviteComunidadeDaUrl() {
  const params = new URLSearchParams(location.search);
  const idConvite = params.get('comunidade');
  if (idConvite) {
    localStorage.setItem('atomoConviteComunidade', JSON.stringify({ id: idConvite, quando: Date.now() }));
    params.delete('comunidade');
    const novaUrl = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
    history.replaceState(null, '', novaUrl);
  }
})();

// mostra um recado na tela de cadastro quando a pessoa chegou por um link de convite de grupo
(function mostrarAvisoConviteNoCadastro() {
  try {
    if (localStorage.getItem('atomoConviteClube') || localStorage.getItem('atomoConviteComunidade')) {
      const aviso = document.getElementById('conviteAuthAviso');
      if (aviso) aviso.style.display = 'block';
    }
  } catch (e) { /* sem storage: sem aviso */ }
})();
