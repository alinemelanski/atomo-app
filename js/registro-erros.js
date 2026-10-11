/* js/registro-erros.js — Registro de erros e eventos de uso
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   Carrega logo depois do config.js, pra já estar "escutando" antes do resto do app.

   COMO FUNCIONA (pra aprender):
   1. window.onerror pega erro de JavaScript que ninguém tratou (ex: chamar uma
      função que não existe).
   2. "unhandledrejection" pega erro de Promise/async que ninguém tratou com catch.
   3. Muitos erros do Supabase NÃO estouram: eles voltam como { error } e o app
      só faz console.log('erro ao carregar ...'). Pra não perder esses, a gente
      "embrulha" o console.log/console.error: se a mensagem começa com "erro",
      também manda pro servidor. (O console continua funcionando igualzinho.)
   4. Tudo vai pro servidor.js (/api/erros), que grava na tabela erros_app.
      Você vê no painel metricas.html.

   Cuidados: a mesma mensagem só é enviada 1 vez por sessão, e no máximo 20 por
   sessão — se algo der errado em loop, não vira uma enxurrada. */

(function () {
  const jaEnviados = new Set();
  let enviadosNaSessao = 0;
  const MAX_POR_SESSAO = 20;

  // qual tela está aberta agora (ajuda a achar o bug depois)
  function telaAtual() {
    const overlay = document.querySelector('.dm-chat-overlay.open, .composer-glass-bg.open');
    if (overlay && overlay.id) return overlay.id;
    const tela = document.querySelector('.screen.active');
    return tela ? tela.id : '';
  }

  async function enviarErro(mensagem, pilha) {
    try {
      mensagem = String(mensagem || '').slice(0, 1000);
      if (!mensagem || jaEnviados.has(mensagem) || enviadosNaSessao >= MAX_POR_SESSAO) return;
      jaEnviados.add(mensagem);
      enviadosNaSessao++;
      // manda o token de login junto (se tiver), pro servidor saber de quem foi
      const headers = { 'Content-Type': 'application/json' };
      if (typeof supabaseClient !== 'undefined') {
        const { data } = await supabaseClient.auth.getSession();
        if (data && data.session) headers.Authorization = 'Bearer ' + data.session.access_token;
      }
      await fetch(API_BASE + '/api/erros', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mensagem, pilha: pilha || null, tela: telaAtual(), navegador: navigator.userAgent }),
        keepalive: true, // deixa a requisição terminar mesmo se a página estiver fechando
      });
    } catch (e) { /* sem internet ou servidor dormindo: deixa pra lá, nunca quebra o app */ }
  }
  window.registrarErro = enviarErro; // dá pra chamar na mão: registrarErro('algo estranho aconteceu')

  window.addEventListener('error', (e) => {
    // erro de imagem/arquivo que não carregou não tem e.message — ignora
    if (!e.message) return;
    enviarErro(e.message + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''), e.error && e.error.stack);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const motivo = e.reason;
    enviarErro('Promise sem tratamento: ' + ((motivo && motivo.message) || motivo), motivo && motivo.stack);
  });

  // embrulha console.log e console.error: continua imprimindo normal,
  // e se a primeira parte for um texto começando com "erro", manda também
  ['log', 'error'].forEach((metodo) => {
    const original = console[metodo].bind(console);
    console[metodo] = function (...args) {
      original(...args);
      try {
        const primeiro = args[0];
        if (typeof primeiro === 'string' && /^\s*(❌\s*)?erro/i.test(primeiro)) {
          const resto = args.slice(1).map(a => (a && a.message) ? a.message : (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          enviarErro((primeiro + ' ' + resto).trim());
        }
      } catch (e) { /* nunca deixa o registro quebrar o console */ }
    };
  });
})();

// ---------- eventos de uso (métricas) ----------
// registrarEventoApp('abriu_app') grava "esta pessoa abriu o app hoje".
// A tabela tem chave (pessoa, tipo, dia), então repetir no mesmo dia não duplica:
// o upsert com ignoreDuplicates simplesmente ignora a segunda vez.
// Pra não ficar indo no banco toda hora, o aparelho lembra o que já registrou hoje.
async function registrarEventoApp(tipo) {
  try {
    const hoje = new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD do aparelho
    const chave = 'atomoEvento_' + tipo;
    if (localStorage.getItem(chave) === hoje) return;
    const { data } = await supabaseClient.auth.getSession();
    if (!data || !data.session) return;
    const { error } = await supabaseClient.from('eventos_app')
      .upsert({ usuario_id: data.session.user.id, tipo }, { onConflict: 'usuario_id,tipo,dia', ignoreDuplicates: true });
    if (!error) localStorage.setItem(chave, hoje);
  } catch (e) { /* métrica nunca pode atrapalhar o app */ }
}
window.registrarEventoApp = registrarEventoApp;
