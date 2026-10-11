/* js/conexoes.js — Visitantes, sugestões de pessoas, seguir/seguidores
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- visitantes ----------
async function atualizarContadorVisitas() {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { count } = await supabaseClient
  .from('visitas')
  .select('*', { count: 'exact', head: true })
  .eq('visitado_id', meuId);

document.getElementById('viewsCount').textContent = count || 0;
}
 window.openVisitantes = async function () {
document.getElementById('perfilInfoOverlay').classList.remove('open');
document.getElementById('visitantesOverlay').classList.add('open');

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { data, error } = await supabaseClient
  .from('visitas')
  .select('*, usuarios!visitas_visitante_id_fkey(handle)')
  .eq('visitado_id', meuId)
  .order('criado_em', { ascending: false });

if (error) { console.log('erro ao carregar visitas:', error.message); return; }

document.getElementById('visitantesList').innerHTML = (data && data.length)
  ? data.map(v => {
      const handle = v.usuarios ? v.usuarios.handle : 'alguém';
      return `<div class="visitor-row">
          <div class="friend-avatar">${handle[0].toUpperCase()}</div>
          <div class="friend-info"><div class="n">@${handle}</div><div class="s">${formatarTempoRelativo(v.criado_em)}</div></div>
        </div>`;
    }).join('')
  : `<div class="visitor-lock-note">Ninguém visitou seu perfil ainda.</div>`;

document.getElementById('viewsCount').textContent = (data ? data.length : 0);
};

// ---------- sugestoes ----------

let SUGESTOES = [];
let SEGUINDO = [];
let SEGUIDORES = [];

window.PERFIL_LISTA_ALVO_ID = null;

async function carregarAmigosEsugestoes(alvoId) {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;
window.PERFIL_LISTA_ALVO_ID = alvoId || null;
const idAlvo = alvoId || meuId;

const { data: bloqueios } = await supabaseClient.from('bloqueios').select('bloqueado_id').eq('usuario_id', meuId);
const idsBloqueados = (bloqueios || []).map(b => b.bloqueado_id);

const { data: todosUsuariosRaw } = await supabaseClient
  .from('usuarios').select('id, nome, handle, bio, avatar_url').neq('id', idAlvo);
const todosUsuarios = (todosUsuariosRaw || []).filter(u => !idsBloqueados.includes(u.id));

// pra saber se EU (quem tá olhando) sigo cada pessoa — o botão seguir/deixar
// de seguir de cada linha é sempre relativo a mim, não a quem tá sendo visto
const { data: euSigo } = await supabaseClient
  .from('seguidores').select('seguido_id').eq('seguidor_id', meuId);
const idsQueEuSigo = (euSigo || []).map(r => r.seguido_id);

// pra saber quem entra na lista "seguindo"/"seguidores" do alvo (que pode ser
// eu mesma ou outra pessoa, quando eu abro o perfil de alguém)
const { data: alvoSegue } = await supabaseClient
  .from('seguidores').select('seguido_id').eq('seguidor_id', idAlvo);
const idsQueAlvoSegue = (alvoSegue || []).map(r => r.seguido_id);

const { data: seguemAlvo } = await supabaseClient
  .from('seguidores').select('seguidor_id').eq('seguido_id', idAlvo);
const idsQueSeguemAlvo = (seguemAlvo || []).map(r => r.seguidor_id);

SEGUINDO = [];
SEGUIDORES = [];
SUGESTOES = [];

(todosUsuarios || []).forEach(u => {
  const euSigoEle = idsQueEuSigo.includes(u.id);
  const item = { id: u.id, nome: u.handle, iniciais: (u.handle || '?')[0].toUpperCase(), avatar: u.avatar_url || null, bio: u.bio || 'sem bio ainda', seguindo: euSigoEle };

  if (idsQueAlvoSegue.includes(u.id)) SEGUINDO.push(item);
  if (idsQueSeguemAlvo.includes(u.id)) SEGUIDORES.push(item);
  if (!alvoId && !euSigoEle && !idsQueSeguemAlvo.includes(u.id)) SUGESTOES.push(item);
});

if (!alvoId) {
  document.getElementById('amigosCount').textContent = SEGUIDORES.length;
  document.getElementById('seguindoCount').textContent = SEGUINDO.length;
}
}

let abaSeguirAtiva = 'seguindo';

window.abrirNovaConversa = async function () {
await carregarAmigosEsugestoes();
document.getElementById('amigosOverlayTitulo').textContent = 'Nova conversa';
document.getElementById('sugestoesSecao').style.display = '';
document.getElementById('amigosOverlay').classList.add('open');
document.getElementById('buscaPessoasInput').value = '';
abaSeguirAtiva = 'seguindo';
document.getElementById('tabSeguindo').classList.add('on');
document.getElementById('tabSeguidores').classList.remove('on');
renderConexoesLista();
renderSugestoesLista();
};

window.openAmigos = async function (abaInicial) {
document.getElementById('perfilInfoOverlay').classList.remove('open');
await carregarAmigosEsugestoes();
document.getElementById('amigosOverlayTitulo').textContent = 'Seguidores';
document.getElementById('sugestoesSecao').style.display = 'none';
document.getElementById('amigosOverlay').classList.add('open');
document.getElementById('buscaPessoasInput').value = '';
abaSeguirAtiva = abaInicial || 'seguindo';
document.getElementById('tabSeguindo').classList.toggle('on', abaSeguirAtiva === 'seguindo');
document.getElementById('tabSeguidores').classList.toggle('on', abaSeguirAtiva === 'seguidores');
renderConexoesLista();
renderSugestoesLista();
};

window.abrirSeguidoresDe = async function (autorId, abaInicial) {
if (!autorId) return;
await carregarAmigosEsugestoes(autorId);
const nomeAlvo = document.getElementById('perfilAlheioHandle') ? document.getElementById('perfilAlheioHandle').textContent : '';
document.getElementById('amigosOverlayTitulo').textContent = nomeAlvo || 'Perfil';
document.getElementById('sugestoesSecao').style.display = 'none';
document.getElementById('amigosOverlay').classList.add('open');
document.getElementById('buscaPessoasInput').value = '';
abaSeguirAtiva = abaInicial || 'seguidores';
document.getElementById('tabSeguindo').classList.toggle('on', abaSeguirAtiva === 'seguindo');
document.getElementById('tabSeguidores').classList.toggle('on', abaSeguirAtiva === 'seguidores');
renderConexoesLista();
};
window.trocarAbaSeguir = function (aba) {
  abaSeguirAtiva = aba;
  document.getElementById('tabSeguindo').classList.toggle('on', aba === 'seguindo');
  document.getElementById('tabSeguidores').classList.toggle('on', aba === 'seguidores');
  renderConexoesLista(document.getElementById('buscaPessoasInput').value);
};
function renderConexoesLista(filtro) {
  const f = (filtro || '').toLowerCase();
  const fonte = abaSeguirAtiva === 'seguindo' ? SEGUINDO : SEGUIDORES;
  const lista = fonte.filter(a => a.nome.toLowerCase().includes(f) || a.bio.toLowerCase().includes(f));
  document.getElementById('amigosList').innerHTML = lista.map(a => `
      <div class="friend-row" onclick="abrirPerfilDoAmigo('${a.id}')">
        <div class="friend-avatar" style="${avatarEstiloBg(a.avatar)}">${avatarConteudo(a.avatar)}</div>
        <div class="friend-info"><div class="n">@${a.nome}</div><div class="s">${a.bio}</div></div>
        <button class="seguir-btn ${a.seguindo ? 'pendente' : ''}" style="flex:none;" onclick="event.stopPropagation(); toggleSeguir('${a.id}', ${a.seguindo}, this)">${a.seguindo ? 'Seguindo' : 'Seguir'}</button>
        <div class="post-action" style="flex:none;" onclick="event.stopPropagation(); abrirDmDireto('${a.id}')">${icone('comentar',14)}</div>
      </div>`).join('') || `<div class="visitor-lock-note">${abaSeguirAtiva === 'seguindo' ? 'Você ainda não segue ninguém.' : 'Ninguém te segue ainda.'}</div>`;
}
function renderSugestoesLista(filtro) {
  const f = (filtro || '').toLowerCase();
  const lista = SUGESTOES.filter(s => s.nome.toLowerCase().includes(f) || s.bio.toLowerCase().includes(f));
  document.getElementById('sugestoesList').innerHTML = lista.map((s, i) => `
      <div class="friend-row" onclick="abrirPerfilDoAmigo('${s.id}')">
        <div class="friend-avatar" style="${avatarEstiloBg(s.avatar)}">${avatarConteudo(s.avatar)}</div>
        <div class="friend-info"><div class="n">@${s.nome}</div><div class="s">${s.bio}</div></div>
        <button class="seguir-btn ${s.seguindo ? 'pendente' : ''}" onclick="event.stopPropagation(); toggleSeguir('${s.id}', ${s.seguindo}, this)">${s.seguindo ? 'Seguindo' : 'Seguir'}</button>
      </div>`).join('') || `<div class="visitor-lock-note">Ninguém encontrado.</div>`;
}
window.filtrarPessoas = function () {
  const termo = document.getElementById('buscaPessoasInput').value;
  renderConexoesLista(termo);
  renderSugestoesLista(termo);
};
window.toggleSeguir = async function (id, seguindoAtualmente, btn) {
  if (navigator.vibrate) navigator.vibrate(10);
  // UI otimista: o botão já muda na hora do toque, antes de esperar o Supabase
  if (btn) {
    btn.textContent = seguindoAtualmente ? 'Seguir' : 'Seguindo';
    btn.classList.toggle('pendente', !seguindoAtualmente);
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session.user.id;

  if (seguindoAtualmente) {
    const { error } = await supabaseClient.from('seguidores').delete().eq('seguidor_id', meuId).eq('seguido_id', id);
    if (error) {
      if (btn) { btn.textContent = 'Seguindo'; btn.classList.add('pendente'); }
      mostrarToast('❌ erro: ' + error.message); return;
    }
    mostrarToast('Deixou de seguir');
  } else {
    const { error } = await supabaseClient.from('seguidores').insert({ seguidor_id: meuId, seguido_id: id });
    if (error) {
      if (btn) { btn.textContent = 'Seguir'; btn.classList.remove('pendente'); }
      mostrarToast('❌ erro: ' + error.message); return;
    }
    mostrarToast('💛 Agora você segue essa pessoa');
    await notificarNovoSeguidor(id, meuId);
  }

  await carregarAmigosEsugestoes();
  renderConexoesLista(document.getElementById('buscaPessoasInput').value);
  renderSugestoesLista(document.getElementById('buscaPessoasInput').value);
};

window.filtrarConteudo = function () {
  const termo = document.getElementById('buscaConteudoInput').value.trim().toLowerCase();
  const lista = document.getElementById('buscaConteudoList');
  // sem termo digitado ainda -- deixa o dropdown escondido, sem placeholder
  // ocupando espaço (ficava feio flutuando vazio logo que abria a busca)
  if (!termo) { lista.innerHTML = ''; lista.classList.remove('show'); return; }
  lista.classList.add('show');
  const resultados = feedPosts.filter(p => p.texto.toLowerCase().includes(termo) || p.tipo.toLowerCase().includes(termo) || p.autor.toLowerCase().includes(termo));
  lista.innerHTML = resultados.length
    ? resultados.map(p => `
        <div class="post" style="margin-bottom:10px;">
          <div class="post-head">
            ${avatarHtml(p.avatarUrl, p.iniciais)}
            <div class="post-who"><div class="n">@${p.autor}</div><div class="t">${p.tempo}</div></div>
            <span class="post-tag">${p.tipo}</span>
          </div>
          <div class="post-body">${formatarMencoes(p.texto)}</div>
        </div>`).join('')
    : `<div class="visitor-lock-note">Nada encontrado pra "${termo}".</div>`;
};

window.irParaAnotacoes = function () {
  abrirPaginaDiario();
};
