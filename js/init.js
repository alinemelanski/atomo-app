/* js/init.js — Inicialização do app (roda por último)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- sessão: ao abrir o app, descobre se já tem login e monta a tela certa ----------
// (fica aqui, no fim, porque o callback depende de funções de todos os outros arquivos)
supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
if (session) {
  const { data: perfilExistente } = await supabaseClient
    .from('usuarios')
    .select('id')
    .eq('id', session.user.id)
    .maybeSingle();

  const contaNova = !perfilExistente;
      if (contaNova) {
    await supabaseClient.from('usuarios').insert({
      id: session.user.id,
      nome: session.user.user_metadata.full_name || session.user.email,
      handle: session.user.email.split('@')[0],
    });
  }

  iniciarHeartbeatPresenca(session.user.id);
  registrarEventoApp('abriu_app'); // métrica: "abriu o app hoje" (1 vez por dia)

     const { data: perfil } = await supabaseClient.from('usuarios').select('nome, handle, bio, avatar_url, streak_atual, modo_escuro, assuntos_favoritos, match_ativado, notif_ativado, genero, match_preferencia, ordem_tipos, emoji_streak, viu_guia_instalacao, pediu_permissao_notif, horario_acordar_min, horario_dormir_min, formato_hora_12h, viu_convite_match, tema_clima, horario_lembrete_leitura_min').eq('id', session.user.id).maybeSingle();

  // conta nova OU conta antiga que nunca completou essas 2 perguntas
  // (bug antigo escondia o onboarding cedo demais, então gente que já
  // tinha conta nunca chegou a ser perguntada) — aborda agora, nessa
  // entrada, em vez de já cair direto no app
  const precisaCompletarOnboarding = contaNova || (perfil && perfil.horario_acordar_min == null);
  if (precisaCompletarOnboarding) {
    avancarOnboard(2);
  } else {
    document.getElementById('onboardOverlay').classList.add('hide');
    // quem já tinha conta e chegou por convite: leva pro grupo agora que a tela de entrada saiu
    setTimeout(() => { verificarConviteClubePendente(); verificarConviteComunidadePendente(); }, 800);
  }

  if (perfil) {
    if (perfil.streak_atual != null) {
      const streakAntigo = perfil.streak_atual;
      const streakCalculado = await calcularStreakReal(session.user.id);

      if (streakCalculado !== streakAntigo) {
        await supabaseClient.from('usuarios').update({ streak_atual: streakCalculado }).eq('id', session.user.id);
      }

      streakAtual = streakCalculado;
      atualizarStreakPill(streakAtual);
      renderSelosPerfil();
      carregarSelosGanhos(session.user.id);
      if (window.STREAK_EM_CHANCE) {
        setTimeout(() => mostrarToast('🛟 Ontem ficou em branco, mas sua ofensiva foi salva por uma chance. Escreve hoje pra continuar!'), 2500);
      }

      if (streakCalculado > streakAntigo) {
        setTimeout(async () => {
          const ganhouSelo = await checarNovoSelo(streakAntigo, streakCalculado);
          if (!ganhouSelo) checarMarco(streakAntigo, streakCalculado);
        }, 600);
      }
    }
    if (perfil.nome) document.getElementById('profNome').textContent = perfil.nome;
    if (perfil.handle) document.getElementById('profHandle').textContent = '@' + perfil.handle;
    if (perfil.bio) document.getElementById('profBio').textContent = perfil.bio;
    if (perfil.avatar_url) aplicarFotoPerfil(perfil.avatar_url);
    else ['perfilProprioAvatarTop', 'perfilProprioAvatarPopup'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = ATOMO_AVATAR_SVG; // sem foto: cara do átomo
    });
    if (perfil.tema_clima) {
      toggleTemaClima(true);
    } else if (perfil.modo_escuro) {
      toggleDarkMode();
    }
    if (perfil.assuntos_favoritos) assuntosFavoritos = perfil.assuntos_favoritos;
    if (perfil.match_preferencia) minhaMatchPref = perfil.match_preferencia;
    if (perfil.genero) meuGenero = perfil.genero;
    if (perfil.ordem_tipos && Array.isArray(perfil.ordem_tipos)) {
      const ordemSalva = perfil.ordem_tipos.filter(t => TIPOS.includes(t));
      const tiposNovos = TIPOS.filter(t => !ordemSalva.includes(t));
      ordemTipos = [...ordemSalva, ...tiposNovos];
    }
    if (Array.isArray(perfil.tipos_ocultos)) tiposOcultos = perfil.tipos_ocultos;
    if (perfil.emoji_streak) {
      meuEmojiStreak = normalizarIconeStreak(perfil.emoji_streak);
      document.getElementById('streakEmoji').innerHTML = iconeStreakHtml(meuEmojiStreak);
    }
    // agora o padrão é DESLIGADO: só liga se a pessoa explicitamente ativou
    // (antes: qualquer valor que não fosse "false" contava como ligado, então
    // toda conta nova/antiga que nunca mexeu nisso já entrava com o Match ligado
    // sem nunca ter sido perguntada)
    if (perfil.match_ativado === true) {
      matchAtivado = true;
      document.getElementById('matchSwitch').classList.add('on');
      document.getElementById('matchBtnTopo').style.display = 'flex';
    } else {
      matchAtivado = false;
      document.getElementById('matchSwitch').classList.remove('on');
      document.getElementById('matchBtnTopo').style.display = 'none';
    }
    atualizarVisibilidadeMatchPref();
    if (perfil.notif_ativado !== undefined) {
      notifAtivo = perfil.notif_ativado;
      document.getElementById('notifSwitch').classList.toggle('on', notifAtivo);
    }
    if (perfil.horario_acordar_min != null) horarioAcordarMin = perfil.horario_acordar_min;
    if (perfil.horario_lembrete_leitura_min != null) horarioLembreteLeituraMin = perfil.horario_lembrete_leitura_min;
    if (perfil.horario_dormir_min != null) horarioDormirMin = perfil.horario_dormir_min;
    if (perfil.formato_hora_12h) {
      formatoHora12h = true;
      const swEl = document.getElementById('formatoHoraSwitch');
      if (swEl) swEl.classList.add('on');
    }
  }
  window.MEU_USUARIO_ID = session.user.id;
  window.MEU_HANDLE = (perfil && perfil.handle) || '';
  window.MINHA_FOTO = (perfil && perfil.avatar_url) || ''; // a mesa ao vivo do clube mostra essa foto pros outros
  window.iniciarRascunhos();
         // nome de verdade em vez do e-mail inteiro — cai pro @handle se não tiver
         // nome salvo, e só usa "por aqui" como último recurso (nunca o e-mail)
         mostrarToast('✨ Bem-vinda de volta, ' + ((perfil && perfil.nome) || (perfil && perfil.handle && ('@' + perfil.handle)) || 'por aqui') + '!');
  // saudação do topo do Home com o primeiro nome (ex: "Ana Paula" -> "Olá, Ana")
  const nomeExibicaoHome = (perfil && perfil.nome && perfil.nome.trim().split(/\s+/)[0])
    || (perfil && perfil.handle && ('@' + perfil.handle))
    || 'por aqui';
  const elSaudacaoHome = document.getElementById('homeSaudacaoTitulo');
  if (elSaudacaoHome) elSaudacaoHome.textContent = 'Olá, ' + nomeExibicaoHome;
  renderHomeSemana();
  renderHomeHumor();
  await carregarAmigosEsugestoes();
  await atualizarContadorVisitas();
  await carregarAmigosParaMencao();
  window.ativarMencaoEmTodosComposers();
  carregarChecklist();
  carregarResumoDia();
  // a cada 5min confere se já é hora do "Seu dia" aparecer (perto de dormir) ou sumir (de manhã)
  setInterval(() => { if (!document.hidden) carregarResumoDia(); }, 5 * 60 * 1000);
  renderDmList();
  carregarPostsReais();
  atualizarBadgePerguntasPendentes();
  carregarPerguntasPublicasMinhas();
  renderMeuPedidoApoio();
  // só dispara aqui pra quem NÃO está prestes a passar pelo onboarding agora —
  // pra conta nova/pendente, confirmarOnboarding() cuida disso no fim de
  // verdade da configuração, senão o guia abria por cima da escolha de tópicos
  if (!precisaCompletarOnboarding) {
    verificarGuiaInstalacao(perfil && perfil.viu_guia_instalacao === true);
  }
  verificarPermissaoNotifPush(perfil && perfil.pediu_permissao_notif === true);
  verificarConviteMatch(matchAtivado, streakAtual, perfil && perfil.viu_convite_match === true);

  // se o app abriu (ou recebeu a mensagem do service worker) por causa de um
  // clique em notificação push ANTES do login terminar, agora sim dá pra rotear
  if (window.NOTIF_DEEP_LINK_PENDENTE) {
    const n = window.NOTIF_DEEP_LINK_PENDENTE;
    window.NOTIF_DEEP_LINK_PENDENTE = null;
    setTimeout(() => {
      abrirNotificacao(n);
      // limpa os parâmetros da URL pra não rotear de novo se a pessoa der F5
      history.replaceState(null, '', location.pathname);
    }, 400);
  }

  supabaseClient
    .channel('notificacoes-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notificacoes',
      filter: `usuario_id=eq.${session.user.id}`,
    }, () => {
      carregarNotificacoes();
      atualizarBadgePerguntasPendentes();
      mostrarToast('🔔 Nova notificação chegou!');
      tocarSom('notificacao'); vibrar([14, 40, 14]);
    })
    .subscribe();

  // mesma lógica pro chat: sem isso, uma DM nova só aparecia quando a pessoa
  // reabria a conversa manualmente. O RLS da tabela 'mensagens' já garante que
  // só chegam aqui linhas que essa sessão tem permissão de ver.
  supabaseClient
    .channel('mensagens-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mensagens',
    }, (payload) => {
      const nova = payload.new;
      if (!nova || nova.autor_id === session.user.id) return;
      const overlayAberto = document.getElementById('dmChatOverlay').classList.contains('open');
      if (overlayAberto && conversaAbertaId === nova.conversa_id) {
        renderDmMsgs();
        supabaseClient.from('mensagens').update({ lida: true }).eq('id', nova.id);
      } else {
        renderDmList();
        mostrarToast('💬 Nova mensagem!');
        tocarSom('notificacao'); vibrar([14, 40, 14]);
      }
    })
    .subscribe();
}    
});

// ---------- inicialização ----------
setTimeout(() => {
  const splash = document.getElementById('splashScreen');
  splash.classList.add('fade-out');
  setTimeout(() => splash.style.display = 'none', 550);
}, 1400);
atualizarHorarioSlider();
aplicarPromptDoMomento();
carregarClimaWidget();
renderSelosPerfil();
renderTypeChips();
renderFeed();
renderDiary();
renderDiscover();
renderLivrosAtual();
renderDmList();
verificarConviteClubePendente();
verificarConviteComunidadePendente();
