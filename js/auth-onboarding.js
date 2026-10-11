/* js/auth-onboarding.js — Horário de acordar, cliente Supabase, login/cadastro e onboarding
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- onboarding: horário de acordar ----------
let horarioAcordarMin = 440; // minutos desde meia-noite (7h20 por padrão)
let horarioLembreteLeituraMin = null; // null = sem lembrete de leitura configurado
let horarioDormirMin = 1350; // minutos desde meia-noite (22h30 por padrão)
let formatoHora12h = false; // preferência de exibição de horário (12h AM/PM vs 24h)

window.atualizarHorarioSlider = function () {
  const val = parseInt(document.getElementById('wakeSlider').value);
  horarioAcordarMin = val;
  const h = Math.floor(val / 60);
  const m = val % 60;
  document.getElementById('wakeValLabel').textContent = `${h}h${m.toString().padStart(2, '0')}`;
};
window.atualizarHorarioSliderDormir = function () {
  const val = parseInt(document.getElementById('sleepSlider').value);
  horarioDormirMin = val;
  const h = Math.floor(val / 60);
  const m = val % 60;
  document.getElementById('sleepValLabel').textContent = `${h}h${m.toString().padStart(2, '0')}`;
};
const supabaseClient = window.supabase.createClient(
  'https://wfhikucbygmjeawrfsfq.supabase.co',
  'sb_publishable_Sqnu4JCusHeikELanoyPpQ_M0UCLEeP'
);


window.voltarTelaInicialAuth = function () {
document.getElementById('linkCriarEmail').style.display = 'block';
document.getElementById('linkJaTenhoConta').style.display = 'block';
document.getElementById('camposEmailArea').style.display = 'none';
document.getElementById('camposLoginArea').style.display = 'none';
};

window.mostrarCamposEmail = function () {
document.getElementById('linkCriarEmail').style.display = 'none';
document.getElementById('linkJaTenhoConta').style.display = 'none';
document.getElementById('camposLoginArea').style.display = 'none';
document.getElementById('camposEmailArea').style.display = 'block';
};

window.mostrarCamposLogin = function () {
document.getElementById('linkCriarEmail').style.display = 'none';
document.getElementById('linkJaTenhoConta').style.display = 'none';
document.getElementById('camposEmailArea').style.display = 'none';
document.getElementById('camposLoginArea').style.display = 'block';
};

const OLHO_ABERTO_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>';
const OLHO_FECHADO_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 4l16 16"/></svg>';
window.alternarVisibilidadeSenha = function (inputId, btn) {
const el = document.getElementById(inputId);
if (el.type === 'password') {
  el.type = 'text';
  btn.innerHTML = OLHO_FECHADO_SVG;
} else {
  el.type = 'password';
  btn.innerHTML = OLHO_ABERTO_SVG;
}
};

window.cadastrarComEmail = async function () {
const email = document.getElementById('emailCadastroInput').value.trim();
const senha = document.getElementById('senhaCadastroInput').value;
const confirmarSenha = document.getElementById('confirmarSenhaCadastroInput').value;
if (!email || senha.length < 6) {
  mostrarToast('❌ preenche e-mail e uma senha com 6+ caracteres');
  return;
}
if (senha !== confirmarSenha) {
  mostrarToast('❌ as senhas não são iguais');
  return;
}

const { data, error } = await supabaseClient.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin } });
if (error) {
  mostrarToast('❌ erro: ' + error.message);
  return;
}

mostrarToast('✨ Conta criada! Confirma seu e-mail pra poder entrar.');
};

window.entrarComEmail = async function () {
const email = document.getElementById('emailLoginInput').value.trim();
const senha = document.getElementById('senhaLoginInput').value;
if (!email || !senha) {
  mostrarToast('❌ preenche e-mail e senha');
  return;
}

const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
if (error) {
  if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
    mostrarToast('❌ confirma seu e-mail antes de entrar');
  } else if (error.message && error.message.toLowerCase().includes('invalid login credentials')) {
    mostrarToast('❌ e-mail ou senha errados');
  } else {
    mostrarToast('❌ erro: ' + error.message);
  }
  return;
}

mostrarToast('✨ Entrando...');
location.reload();
};

window.esqueciMinhaSenha = async function () {
const email = document.getElementById('emailLoginInput').value.trim();
if (!email) {
  mostrarToast('❌ digita seu e-mail no campo acima primeiro');
  return;
}
const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
  redirectTo: window.location.origin,
});
if (error) {
  mostrarToast('❌ erro: ' + error.message);
  return;
}
mostrarToast('✨ Te mandamos um e-mail pra redefinir a senha');
};

window.loginComGoogle = async function () {
// usa origin (sem barra/caminho/parâmetros no final), igual o resto do app —
// location.href pode virar "http://localhost:3000/" (com barra), que não bate
// com a URL cadastrada sem barra na lista de redirect do Supabase, e aí ele
// cai no site de produção em vez de voltar pro localhost
const { error } = await supabaseClient.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin }
});
if (error) { 
  mostrarToast('❌ erro no login: ' + error.message);
}
};

window.avancarOnboard = function (etapa) {
  document.querySelectorAll('.onboard-step').forEach(s => s.style.display = 'none');
  document.getElementById('onboardStep' + etapa).style.display = 'flex';
  if (etapa === 3) renderOnboardTopics();
};

let assuntosFavoritos = [];
function renderOnboardTopics() {
  document.getElementById('onboardTopicGrid').innerHTML = INTERESSES_CADASTRO.map(t =>
    `<div class="onboard-topic-chip ${assuntosFavoritos.includes(t) ? 'on' : ''}" onclick="selecionarAssuntoFavorito('${t}')">${t}</div>`
  ).join('');
}
window.selecionarAssuntoFavorito = function (t) {
  if (assuntosFavoritos.includes(t)) {
    assuntosFavoritos = assuntosFavoritos.filter(x => x !== t);
  } else {
    if (assuntosFavoritos.length >= 5) {
      mostrarToast('Escolhe até 5 — tira um pra trocar 🙂');
      return;
    }
    assuntosFavoritos.push(t);
  }
  renderOnboardTopics();
};

window.confirmarOnboarding = async function () {
  document.getElementById('onboardOverlay').classList.add('hide');
  mostrarToast(assuntosFavoritos.length ? `✨ Combinado! Mais ${assuntosFavoritos.join(', ').toLowerCase()} no seu feed` : '✨ Combinado! Bom dia chega no seu horário');
  renderFeed();

  const { data: sessionData } = await supabaseClient.auth.getSession();
  await supabaseClient.from('usuarios').update({
    assuntos_favoritos: assuntosFavoritos,
    horario_acordar_min: horarioAcordarMin,
    horario_dormir_min: horarioDormirMin,
  }).eq('id', sessionData.session.user.id);

  setTimeout(() => {
    adicionarNotificacao('☀️', 'Bom dia! ✨', 'Como foi o seu sonho essa noite? Registra antes que esqueça 💭', 'irParaEscrita');
  }, 4000);

  // pede permissão de notificação externa já no cadastro, como combinado
  // (via banner com botão, pra não ser bloqueado silenciosamente pelo navegador)
  setTimeout(() => mostrarBannerNotificacao(), 1200);

  // só agora, com a configuração de verdade concluída e a pessoa já na
  // Home/Perfil, mostra o guia de instalação do PWA (antes disparava em
  // cima da escolha de tópicos, no meio do onboarding — confuso)
  setTimeout(() => verificarGuiaInstalacao(false), 2600);

  // veio por convite de grupo? cadastro e perguntas já foram, agora leva ela até lá
  setTimeout(() => { verificarConviteClubePendente(); verificarConviteComunidadePendente(); }, 1800);
};
