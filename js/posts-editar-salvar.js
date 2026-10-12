/* js/posts-editar-salvar.js — Editar post e salvar (favoritar) post
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.

   EDITAR: só o dono do post vê o lápis. Ao salvar, o texto muda e a coluna
   editado_em recebe a hora — é ela que faz aparecer "· editado" no card.
   A segurança de verdade está no banco (RLS de UPDATE em posts: só o dono
   altera); o .eq('autor_id', ...) aqui é uma segunda trava.

   SALVAR: tabela posts_salvos, uma linha = "eu salvei tal post". Privado:
   ninguém vê o que você salvou. A lista fica em Perfil → "salvos". */

let postEmEdicaoId = null;

// procura o texto do post onde ele estiver carregado (Feed ou Diário)
function acharPostCarregado(postId) {
  const doFeed = (typeof feedPosts !== 'undefined' ? feedPosts : []).find(p => p.id === postId);
  if (doFeed) return doFeed;
  return (typeof diarioEntradasCache !== 'undefined' ? diarioEntradasCache : []).find(e => e.id === postId) || null;
}

window.abrirEditarPost = function (postId) {
  const post = acharPostCarregado(postId);
  if (!post) { mostrarToast('❌ não encontrei esse post'); return; }
  postEmEdicaoId = postId;
  document.getElementById('editarPostTitulo').textContent = t('post_editar');
  document.getElementById('editarPostCancelar').textContent = t('cancelar');
  document.getElementById('editarPostSalvar').textContent = t('salvar');
  const campo = document.getElementById('editarPostTexto');
  campo.value = post.texto || '';
  document.getElementById('editarPostOverlay').classList.add('open');
  setTimeout(() => { campo.focus(); campo.setSelectionRange(campo.value.length, campo.value.length); }, 250);
};

window.salvarEdicaoPost = async function () {
  const texto = document.getElementById('editarPostTexto').value.trim();
  if (!texto || !postEmEdicaoId) return;
  const btn = document.getElementById('editarPostSalvar');
  btn.disabled = true;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const { error } = await supabaseClient.from('posts')
    .update({ texto, editado_em: new Date().toISOString() })
    .eq('id', postEmEdicaoId)
    .eq('autor_id', sessionData.session.user.id);

  btn.disabled = false;
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  closeOverlay('editarPostOverlay');
  mostrarToast('✏️ ' + t('post_editado_ok'));
  postEmEdicaoId = null;
  // recarrega onde o post aparece
  carregarPostsReais();
  renderDiary();
};

window.alternarSalvarPost = async function (postId) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const meuId = sessionData.session.user.id;
  const jaSalvo = idsSalvos.has(postId);

  // muda na tela NA HORA (resposta rápida), e desfaz se o banco recusar
  const aplicar = (salvo) => {
    if (salvo) idsSalvos.add(postId); else idsSalvos.delete(postId);
    feedPosts.forEach(p => { if (p.id === postId) p.salvo = salvo; });
    renderFeed();
  };
  aplicar(!jaSalvo);

  const { error } = jaSalvo
    ? await supabaseClient.from('posts_salvos').delete().eq('usuario_id', meuId).eq('post_id', postId)
    : await supabaseClient.from('posts_salvos').insert({ usuario_id: meuId, post_id: postId });

  if (error) { aplicar(jaSalvo); mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast(jaSalvo ? t('post_removido_salvos') : '🔖 ' + t('post_salvo_ok'));
};

// lista de salvos (Perfil → "salvos")
window.abrirSalvos = async function () {
  closeOverlay('perfilInfoOverlay');
  document.getElementById('salvosTitulo').textContent = t('salvos_titulo');
  const lista = document.getElementById('salvosList');
  lista.innerHTML = skeletonPosts(2);
  document.getElementById('salvosOverlay').classList.add('open');

  const { data: sessionData } = await supabaseClient.auth.getSession();
  // "posts(...)" traz junto o post de cada linha salva (o Supabase segue a chave estrangeira post_id)
  const { data, error } = await supabaseClient
    .from('posts_salvos')
    .select('salvo_em, posts(id, texto, tipo, imagem_url, criado_em, editado_em, autor_id, usuarios!autor_id(handle, avatar_url))')
    .eq('usuario_id', sessionData.session.user.id)
    .order('salvo_em', { ascending: false });

  if (error) { console.log('erro ao carregar salvos:', error.message); lista.innerHTML = estadoVazio(t('salvos_vazio_titulo'), t('salvos_vazio_sub'), null, null); return; }
  const posts = (data || []).map(l => l.posts).filter(Boolean);
  lista.innerHTML = posts.map(p => {
    const handle = p.usuarios ? p.usuarios.handle : 'alguem';
    return `<div class="post">
        <div class="post-head">
          ${avatarHtml(p.usuarios && p.usuarios.avatar_url, handle[0], { onclick: "abrirPerfilAlheio('" + p.autor_id + "')" })}
          <div class="post-who" style="cursor:pointer;" onclick="abrirPerfilAlheio('${p.autor_id}')"><div class="n">@${handle}</div><div class="t">${formatarTempoRelativo(p.criado_em)}${p.editado_em ? ' · ' + t('post_editado') : ''}</div></div>
          <span class="post-tag">${p.tipo}</span>
        </div>
        <div class="post-body">${formatarMencoesEVideo(p.texto)}</div>
        ${p.imagem_url ? `<img src="${p.imagem_url}" class="post-foto-fixa" loading="lazy" />` : ''}
        <div class="post-actions">
          <div class="post-action ativo" onclick="removerDosSalvos(${p.id})" aria-label="${t('post_remover_salvo')}">${icone('salvar', 14, 0)} ${t('post_remover_salvo')}</div>
        </div>
      </div>`;
  }).join('') || estadoVazio(t('salvos_vazio_titulo'), t('salvos_vazio_sub'), null, null);
};

window.removerDosSalvos = async function (postId) {
  // aqui o post COM CERTEZA está salvo (está na lista), então apaga direto
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const { error } = await supabaseClient.from('posts_salvos').delete()
    .eq('usuario_id', sessionData.session.user.id).eq('post_id', postId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  idsSalvos.delete(postId);
  feedPosts.forEach(p => { if (p.id === postId) p.salvo = false; });
  mostrarToast(t('post_removido_salvos'));
  abrirSalvos();
};
