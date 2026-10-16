/* js/seu-dia.js — card "Seu dia" da Home: resumo da noite, montado aqui no aparelho
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa.

   COMO FUNCIONA (em 4 passos):
   1. Durante o dia o app só COLETA (toques de emoção, escritas, leitura). O card fica escondido.
   2. À noite (30min antes da hora de dormir da pessoa, até a hora de acordar) o card aparece.
   3. montarResumoDoDia() recebe os dados do dia e devolve o texto pronto (função "pura": não mexe
      na tela nem no banco, então dá pra testar sozinha).
   4. carregarResumoDia() busca os dados no Supabase, chama a função acima e desenha o resultado.

   De onde vêm os conselhos (pesquisados em fontes de psicologia, sem prometer cura de nada):
   - "Três coisas boas": Greater Good Science Center (UC Berkeley) — Seligman et al., 2005: mais
     bem-estar mesmo meses depois de uma semana de prática.
   - Autocompaixão: Leary et al., 2007 — quem se trata com gentileza lida melhor com o que dá errado.
   - Ativação comportamental: pequenas ações (caminhar, falar com alguém) ajudam o humor a se mover.
   - Respiração com expiração longa, anotar preocupações antes de dormir, rotina de sono regular.
   Pra "se atualizar dia após dia": cada lista abaixo tem várias versões e o app escolhe uma por dia
   (escolherDoDia). Pra entrar conselho novo, é só acrescentar um item na lista certa. */

const SUBSTANTIVO_HUMOR = { feliz: 'alegria', calma: 'calma', triste: 'tristeza', ansiosa: 'ansiedade', brava: 'raiva' };
const HUMORES_POSITIVOS = ['feliz', 'calma'];

// ---------- frases (ironia do bem: provoca de leve, nunca ri de quem está mal) ----------
const TITULOS_DIA = {
  feliz: ['Um dia de brilho', 'Hoje teve leveza', 'Dia bom de guardar'],
  calma: ['Um dia sereno', 'Hoje foi de respirar fundo', 'Um dia de ritmo calmo'],
  triste: ['Um dia mais pesado', 'Hoje pediu delicadeza', 'Dia de sentir devagar'],
  ansiosa: ['Um dia de mente acelerada', 'Hoje a cabeça correu', 'Dia de muitas voltas por dentro'],
  brava: ['Um dia de faíscas', 'Hoje teve intensidade', 'Dia de sentimento forte'],
  misto: ['Um dia de várias estações', 'Hoje teve de tudo um pouco'],
  escrita: ['Seu dia em palavras', 'Hoje você escreveu'],
};

const ABERTURAS = {
  feliz: [
    'Olha só: alguém passou o dia inteiro de bom humor e nem avisou ninguém. Estamos de olho.',
    'Dia bom assim devia vir com aviso na embalagem: cuidado, pode causar sorriso espontâneo.',
    'Se alegria desse multa, você hoje estaria devendo bastante.',
  ],
  calma: [
    'Calma: a palavra do dia. Você tratou o dia com a elegância de quem não tem pressa nenhuma.',
    'Dia tranquilo assim é raro. Anota a receita, porque ela vale ouro.',
    'Paz de espírito às claras, sem pedir licença. Que ousadia a sua.',
  ],
  triste: [
    'O dia veio de salto alto e pisou em você um pouquinho. Ainda assim, você chegou até o fim dele, e isso não é pouca coisa.',
    'Tem dia que o mundo exagera na dose. Mesmo assim você parou pra registrar o que sentiu, o que já é um jeito de se cuidar.',
    'Hoje pesou. Sem drama e sem pressa: você não precisa dar conta de tudo antes de dormir.',
  ],
  ansiosa: [
    'Sua cabeça hoje correu uma maratona sem ninguém ter dado a largada. Ao menos o condicionamento está em dia.',
    'Pensamento acelerado hoje, hein? Ele trabalhou em horário extra e sem receber por isso.',
    'A ansiedade passou o dia dando palpite em tudo. Você, ao menos, ainda está aqui, aguentando firme.',
  ],
  brava: [
    'Hoje alguém (ou algo) testou sua paciência. Sua raiva foi educada o bastante pra deixar registro. Respeito.',
    'Raiva é só energia sem endereço. Hoje ela apareceu, e você ainda teve a calma de anotar.',
    'O dia veio com faíscas, mas ninguém saiu queimado. Pontos pra você.',
  ],
  misto: [
    'Seu dia foi uma montanha-russa completa, daquelas com direito a foto no final. Bora olhar o que rolou.',
    'Hoje teve de tudo um pouco, um verdadeiro bufê de emoções. E você provou cada prato sem reclamar.',
    'Um pouco de cada sentimento, como quem não quer deixar nenhum de fora. Ninguém pode dizer que seu dia foi monótono.',
  ],
  escrita: [
    'Você fez do papel o seu confidente hoje. Ele ouviu tudo e ainda guardou segredo.',
    'Escrever é falar sem ser interrompido. Ótimo uso do dia.',
  ],
};

const FECHOS = {
  leve: [
    'Resumindo: um dia bom, com testemunhas e tudo. Agora vai dormir feliz da vida, que amanhã eu estarei contando seus cliques de novo.',
    'Conclusão oficial: você até que se deu bem hoje. Não se acostume (brincadeira: acostume-se, sim).',
    'Fim de expediente, gente boa. Pode desligar o dia com a consciência tranquila.',
  ],
  pesado: [
    'Mesmo com o dia pesado, você registrou, parou e se olhou. Dormir é a melhor coisa que dá pra fazer agora, e amanhã começa do zero.',
    'Você não resolveu o mundo, e nem precisava. Descansa: o amanhã chega sem pedir nada de você agora.',
    'Dia difícil também faz parte da coleção. Esse já passou, e você segue aqui.',
  ],
  misto: [
    'Balanço do dia: emoção de sobra, tédio zero. Durma bem, que a próxima temporada estreia amanhã.',
    'Foi um dia de muito sentimento, e você deu conta de todos. Pode apagar a luz com orgulho.',
    'Quem sente bastante vive bastante. Agora dá uma pausa e deixa o corpo descansar também.',
  ],
};

// cada conselho tem: título curto, o que fazer e o "por quê" (a base por trás, em linguagem simples)
const CONSELHOS_POR_HUMOR = {
  feliz: [
    { t: 'Guarde esse dia', o: 'Escreva em uma frase o que fez o dia bom. Sem capricho, só pra lembrar depois.', p: 'Reviver coisas boas por escrito faz o cérebro "gravar" melhor o que foi bom, e não só o que foi ruim.' },
    { t: 'Divida a alegria', o: 'Conte para alguém o que te deixou bem hoje. Pode ser uma mensagem de três linhas.', p: 'Contar uma boa notícia para alguém costuma aumentar o prazer do momento, e fortalece o vínculo também.' },
    { t: 'Descubra a receita', o: 'Pense no que ajudou hoje a ser bom (sono, comida, pessoa, lugar) e anote um item pra repetir amanhã.', p: 'Saber o que funciona pra você é o primeiro passo pra ter mais dias assim de propósito, e não só por sorte.' },
  ],
  calma: [
    { t: 'Capriche no embalo', o: 'Aproveite a calma: dez minutos de leitura ou música tranquila antes de dormir.', p: 'Terminar o dia num ritmo lento ajuda o corpo a entender que já pode desligar.' },
    { t: 'Repare no que trouxe a calma', o: 'Anote uma coisa que deixou o dia mais leve (um lugar, uma pessoa, uma pausa).', p: 'Quem aprende a reconhecer o que acalma consegue repetir isso nos dias mais agitados.' },
    { t: 'Planeje leve', o: 'Escolha UMA coisa importante pra amanhã. Só uma. O resto é bônus.', p: 'Lista curta reduz a sensação de peso e aumenta a chance de realmente começar.' },
  ],
  triste: [
    { t: 'Um gesto pequeno de cuidado', o: 'Beba água, abra a janela e, se der, dê uma volta curta (até no quarteirão).', p: 'Na terapia chamada ativação comportamental, agir um pouquinho costuma vir antes da vontade, e não depois.' },
    { t: 'Escreva sem cobrar nada', o: 'Escreva três linhas sobre o que pesou hoje. Não precisa ter começo, meio e fim.', p: 'Pôr em palavras o que a gente sente é um hábito bem estudado pra aliviar a cabeça.' },
    { t: 'Fale consigo como falaria com uma amiga', o: 'Pense: o que eu diria a alguém querido que passou por isso hoje? Diga a mesma coisa a você.', p: 'Pesquisas sobre autocompaixão (Leary e colegas, 2007) mostram que quem se trata com gentileza lida melhor com o que dá errado.' },
  ],
  ansiosa: [
    { t: 'Respire mais devagar pra fora', o: 'Inspire contando 4, solte contando 6. Repita cinco vezes, sem forçar.', p: 'Soltar o ar mais devagar do que puxa ajuda o corpo a sair do modo "alerta".' },
    { t: 'Tire a lista da cabeça', o: 'Escreva as três coisas que mais ocupam sua mente. Ao lado, escreva só o primeiro passo pequeno de cada uma. Depois feche o caderno.', p: 'Existe estudo (Scullin e colegas, 2018) em que quem anotava o que ia fazer antes de dormir pegava no sono mais rápido.' },
    { t: 'Dê um horário pra preocupação', o: 'Se a mente insistir hoje à noite, diga: "isso fica pra amanhã, às 17h". Anote e vá dormir.', p: 'Adiar a preocupação pra um horário combinado é uma técnica usada na terapia cognitivo-comportamental pra ela parar de invadir todo o dia.' },
  ],
  brava: [
    { t: 'Dê uma saída pra energia', o: 'Caminhe uns dez minutos, ou sacuda braços e pernas por um minuto. O corpo precisa descarregar.', p: 'A raiva é uma mistura de pensamento e energia física. Mexer o corpo costuma ajudar a baixar o volume.' },
    { t: 'Escreva o que não pôde dizer', o: 'Escreva sem filtro tudo o que irritou. Depois rasgue, apague ou feche o caderno. Não precisa enviar a ninguém.', p: 'Tirar da cabeça pro papel ajuda a organizar o que aconteceu antes de reagir.' },
    { t: 'Água fria e pausa', o: 'Lave o rosto com água fria e faça três respirações lentas antes de qualquer conversa difícil.', p: 'A intensidade da raiva tende a cair depois de alguns minutos de pausa. Responder depois costuma sair melhor.' },
  ],
  misto: [
    { t: 'Nomeie o que sentiu', o: 'Escolha UMA emoção do dia e diga a si mesmo: "hoje eu senti X porque Y".', p: 'Pesquisas sobre "rotular emoções" mostram que nomear o que se sente ajuda a baixar a intensidade.' },
    { t: 'Fim de noite simples', o: 'Luz baixa e alguns minutos longe da tela. Dia cheio de emoção pede um final calmo.', p: 'Luz forte e tela acesa tardam o sono. Reduzir isso avisa o corpo de que a noite chegou.' },
  ],
  escrita: [
    { t: 'Releia com carinho', o: 'Releia o que você escreveu hoje e sublinhe mentalmente uma frase da qual gostou.', p: 'Reler o que escrevemos mostra o que realmente importou, e isso costuma passar despercebido na correria.' },
  ],
};

const CONSELHOS_SONO = [
  { t: 'Desacelere uns 30 minutos antes de dormir', o: 'Luz baixa, celular longe da cama e nada de discussão ou notícia pesada nessa meia hora.', p: 'Luz forte e conteúdo agitado atrasam o sono. Uma rotina de desacelerar avisa ao corpo que dá pra desligar.' },
  { t: 'Durma e acorde em horários parecidos', o: 'Tente ir dormir e acordar quase na mesma hora, inclusive no fim de semana.', p: 'O corpo tem um "relógio" interno e gosta de regularidade: isso melhora a qualidade do sono.' },
  { t: 'Deixe o quarto fresco e escuro', o: 'Uma janela entreaberta, cortina fechada e a luz do celular virada pra baixo já ajudam.', p: 'Ambiente fresco e escuro ajuda o corpo a baixar a temperatura e entrar no sono.' },
];

const CONSELHOS_GRATIDAO = [
  { t: 'Três coisas boas', o: 'Antes de dormir, escreva três coisas que deram certo hoje (pode ser pequena, tipo café quente) e por que elas aconteceram.', p: 'Exercício do Greater Good Science Center (UC Berkeley): em estudo de Seligman e colegas (2005), uma semana disso deixou as pessoas mais felizes por meses.' },
  { t: 'Um gesto gentil pra você mesmo', o: 'Escolha uma coisa simples que você faria por um amigo (chá, música, banho demorado) e faça por você agora.', p: 'A autocompaixão está ligada a mais energia e menos autocrítica diante de dias difíceis (Leary e colegas, 2007).' },
  { t: 'Uma coisa que você fez bem', o: 'Pense em UMA coisa que você fez bem hoje, por menor que seja, e diga a si mesmo "bom trabalho".', p: 'Reparar nos próprios acertos equilibra a tendência natural da mente de lembrar mais do que deu errado.' },
];

// escolhe por rotação do dia (não por sorteio), pra não mudar de texto toda vez que o card recarrega
function escolherDoDia(lista, deslocamento) {
  const diaDoAno = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
  return lista[(diaDoAno + (deslocamento || 0)) % lista.length];
}

// ---------- períodos do dia (em vez de horário exato) ----------
// O resumo fala "pela manhã", "pela tarde"... e não "às 15h42": ninguém lembra do minuto,
// mas lembra de como estava de manhã ou de tarde.
const ORDEM_PERIODOS = ['madrugada', 'manha', 'tarde', 'noite'];
const ROTULO_PERIODO = { madrugada: 'de madrugada', manha: 'pela manhã', tarde: 'pela tarde', noite: 'à noite' };
const NOME_PERIODO_PLURAL = { madrugada: 'madrugadas', manha: 'manhãs', tarde: 'tardes', noite: 'noites' };
function periodoDoDia(iso) {
  const h = new Date(iso).getHours();
  if (h < 5) return 'madrugada';
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}
function maiuscula(t) { return t ? t[0].toUpperCase() + t.slice(1) : t; }

// junta uma lista em português: ["a","b","c"] → "a, b e c"
function juntarComE(lista) {
  if (lista.length <= 1) return lista.join('');
  return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
}

// Agrupa os toques de humor por período e descreve cada um:
// "pela manhã você esteve calma" / "pela tarde você oscilou entre alegria e ansiedade".
// Se escreveu naquele período, junta: "...e foi quando você escreveu".
function frasesPorPeriodo(eventos, posts) {
  const porPeriodo = {};
  eventos.forEach(e => {
    const p = periodoDoDia(e.criado_em);
    (porPeriodo[p] = porPeriodo[p] || {})[e.emocao] = (porPeriodo[p][e.emocao] || 0) + 1;
  });
  const escreveuEm = new Set(posts.filter(x => x.criado_em).map(x => periodoDoDia(x.criado_em)));
  // 1º período: frase completa ("Pela manhã você esteve calma.")
  // os seguintes: curtinhas, sem repetir "você esteve" ("Pela tarde, feliz.")
  return ORDEM_PERIODOS.filter(p => porPeriodo[p]).map((p, i) => {
    const ord = Object.entries(porPeriodo[p]).sort((a, b) => b[1] - a[1]);
    // um humor só, ou um que claramente ganhou dos outros: "esteve X"; empate: "entre X e Y"
    const claro = ord.length === 1 || ord[0][1] > ord[1][1];
    const humor = claro ? ord[0][0] : `entre ${SUBSTANTIVO_HUMOR[ord[0][0]]} e ${SUBSTANTIVO_HUMOR[ord[1][0]]}`;
    let f = i === 0
      ? `${maiuscula(ROTULO_PERIODO[p])} você ${claro ? 'esteve ' + humor : 'oscilou ' + humor}`
      : `${maiuscula(ROTULO_PERIODO[p])}, ${humor}`;
    if (escreveuEm.has(p)) f += ', e foi quando você escreveu';
    return f + '.';
  });
}

// "Hoje foi..." — uma frase curta que fecha o dia, conforme o tom
const HOJE_FOI = {
  leve: ['Hoje foi um dia leve 🌿', 'Hoje foi um dia bom de guardar ☀️', 'Hoje foi um dia de respirar fácil 🌿'],
  pesado: ['Hoje pesou um pouco, e tudo bem. Amanhã é outra página.', 'Hoje foi um dia difícil, e você chegou até o fim dele.', 'Hoje pediu mais de você. Amanhã é outra página.'],
  misto: ['Hoje foi um dia de várias cores.', 'Hoje foi um dia de altos e baixos, como quase todo dia de verdade.'],
};

// Resumo da semana (só aos domingos): compara manhãs, tardes e noites dos últimos 7 dias
// e conta em qual período a pessoa costuma estar mais leve.
function resumoDaSemanaPorPeriodo(eventosSemana) {
  const grupos = {};
  eventosSemana.filter(e => e.criado_em).forEach(e => {
    const p = periodoDoDia(e.criado_em);
    (grupos[p] = grupos[p] || []).push(e);
  });
  // só compara períodos com registros suficientes (3 ou mais), pra não tirar conclusão de um toque só
  const fatias = ORDEM_PERIODOS.filter(p => grupos[p] && grupos[p].length >= 3)
    .map(p => ({ p, f: fatiaPositiva(grupos[p]) }))
    .sort((a, b) => b.f - a.f);
  if (fatias.length < 2) return null;
  const melhor = fatias[0], pior = fatias[fatias.length - 1];
  if (melhor.f - pior.f < 0.2) return 'Resumo da semana: seu humor ficou parecido de manhã, de tarde e de noite. Uma semana de ritmo constante.';
  return `Resumo da semana: suas ${NOME_PERIODO_PLURAL[melhor.p]} foram mais leves que suas ${NOME_PERIODO_PLURAL[pior.p]}. Vale reparar o que costuma acontecer em cada uma.`;
}

function limparTrecho(texto, max) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '…' : t;
}

// fatia (0 a 1) de toques positivos num monte de eventos
function fatiaPositiva(eventos) {
  if (!eventos.length) return null;
  return eventos.filter(e => HUMORES_POSITIVOS.includes(e.emocao)).length / eventos.length;
}

// ---------- monta o conteúdo (função pura: recebe dados, devolve texto; fácil de testar) ----------
// eventos: toques de emoção do dia | posts: o que foi escrito | semana: toques dos 7 dias anteriores
function montarResumoDoDia({ eventos, posts, leuHoje, ontem, semana, sequencia, domingo }) {
  const n = eventos.length;
  const contagem = {};
  eventos.forEach(e => { contagem[e.emocao] = (contagem[e.emocao] || 0) + 1; });
  const ordenadas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  const dominante = ordenadas.length ? ordenadas[0][0] : null;
  const misto = ordenadas.length >= 4 || (ordenadas.length >= 3 && ordenadas[0][1] / n < 0.45);
  const chave = !n ? 'escrita' : (misto ? 'misto' : dominante);
  const fatia = fatiaPositiva(eventos);
  const tom = fatia === null ? 'misto' : (fatia >= 0.6 ? 'leve' : (fatia <= 0.34 ? 'pesado' : 'misto'));

  const titulo = escolherDoDia(TITULOS_DIA[chave], 0);
  const abertura = escolherDoDia(ABERTURAS[chave], 1);
  const fecho = escolherDoDia(HOJE_FOI[tom], 6) + ' ' + escolherDoDia(FECHOS[tom], 2);

  // ---- "o que rolou" ----
  const frases = [];
  const periodos = frasesPorPeriodo(eventos, posts);
  if (n && ordenadas.length === 1 && periodos.length > 1) {
    // o mesmo humor o dia inteiro: uma frase só basta
    frases.push(`Hoje o tom foi de ${SUBSTANTIVO_HUMOR[dominante]} o dia todo, ${juntarComE(ORDEM_PERIODOS.filter(p => eventos.some(e => periodoDoDia(e.criado_em) === p)).map(p => ROTULO_PERIODO[p]))}.`);
  } else if (n) {
    frases.push(...periodos);
    if (!misto && periodos.length > 1) frases.push(`${maiuscula(SUBSTANTIVO_HUMOR[dominante])} foi o que mais apareceu.`);
  }
  let trechoDestaque = null;
  if (posts.length) {
    // se escreveu num período sem toque de humor, a frase de período não falou disso: conta aqui
    const jaContou = periodos.some(f => f.includes('escreveu'));
    if (!jaContou || posts.length > 1) frases.push(`Você escreveu ${posts.length === 1 ? 'uma vez' : posts.length + ' vezes'} hoje.`);
    const maior = posts.slice().sort((a, b) => String(b.texto || '').length - String(a.texto || '').length)[0];
    if (maior && String(maior.texto || '').trim().length >= 12) trechoDestaque = limparTrecho(maior.texto, 90);
  }
  if (leuHoje) frases.push('E ainda passou pelos seus livros hoje.');

  // ---- "o que eu reparei" (cada item é um argumento baseado nos dados do dia) ----
  const observacoes = [];
  if (ordenadas.length >= 3) {
    observacoes.push(`Você passou por ${ordenadas.length} emoções diferentes hoje. Saber dar nome ao que se sente é meio caminho andado pra lidar com isso, e você fez esse exercício ${n} vezes.`);
  }
  if (n >= 4) {
    const porPeriodo = {};
    eventos.forEach(e => { const p = periodoDoDia(e.criado_em); porPeriodo[p] = (porPeriodo[p] || 0) + 1; });
    const ord = Object.entries(porPeriodo).sort((a, b) => b[1] - a[1]);
    const pico = ord[0];
    // só fala do "período mais movimentado" se ele ganhou de verdade (sem empate)
    if (pico[1] >= 2 && ord.length > 1 && pico[1] > ord[1][1]) {
      observacoes.push(`${maiuscula(ROTULO_PERIODO[pico[0]].replace(/^pela |^à |^de /, 'a '))} foi o período mais movimentado, com ${pico[1]} registros. Vale reparar o que costuma acontecer nessa hora do dia.`);
    }
  }
  if (n >= 2) {
    const pos = e => HUMORES_POSITIVOS.includes(e.emocao);
    const primeiro = eventos[0], ultimo = eventos[n - 1];
    if (!pos(primeiro) && pos(ultimo)) observacoes.push('Você começou o dia num clima mais pesado e terminou melhor do que começou. O dia melhorou no caminho, e isso conta a seu favor.');
    else if (pos(primeiro) && !pos(ultimo)) observacoes.push('O dia começou bem e esquentou no fim. Isso é comum: o cansaço do fim do dia aumenta a sensibilidade. Amanhã é folha em branco.');
  }
  if (semana && semana.length >= 5 && fatia !== null && n >= 2) {
    const fatiaSemana = fatiaPositiva(semana);
    if (fatia - fatiaSemana >= 0.2) observacoes.push('Comparando com a sua semana, esse dia foi mais leve que o normal. Boa! Ao menos um motivo pra comemorar.');
    else if (fatiaSemana - fatia >= 0.2) observacoes.push('Comparando com a sua semana, esse dia foi mais pesado que o normal. Um dia fora da curva não define a semana. Cuide de você essa noite.');
  }
  if (domingo) {
    const daSemana = resumoDaSemanaPorPeriodo((semana || []).concat(eventos));
    if (daSemana) observacoes.unshift(daSemana);
  }
  if (posts.length) observacoes.push('Pôr em palavras o que se sente é um dos hábitos mais estudados pra aliviar a cabeça, e você fez isso hoje.');
  if (leuHoje) observacoes.push('Você arrumou tempo pra ler. Ler um pouco antes de dormir costuma desacelerar a mente e ajuda a pegar no sono.');
  if (sequencia >= 3) observacoes.push(`${sequencia} dias seguidos aparecendo por aqui. Constância pequena ganha de empolgação grande, e você está provando isso.`);
  // sinal de cuidado: só aparece quando o peso se repete ao longo da semana
  const todos = (semana || []).concat(eventos);
  const peso = todos.length >= 8 ? 1 - fatiaPositiva(todos) : 0;
  if (peso >= 0.7) observacoes.push('Faz alguns dias que os registros vêm pesados. Se isso continuar, conversar com alguém de confiança ou com um profissional ajuda de verdade. O CVV atende 24h pelo 188, de graça.');

  // ---- conselhos: um pro humor do dia + um de sono + um de acolhimento/gratidão ----
  const conselhos = [
    escolherDoDia(CONSELHOS_POR_HUMOR[chave], 3),
    escolherDoDia(CONSELHOS_SONO, 4),
    escolherDoDia(CONSELHOS_GRATIDAO, 5),
  ];

  let tituloFinal = titulo, aberturaFinal = abertura, textoFinal = frases.join(' '), fechoFinal = fecho;
  let obsFinal = observacoes.slice(0, 4);
  if (ontem) {
    // card visto depois da meia-noite: o texto fala de "ontem" (os conselhos continuam valendo pro hoje)
    const paraOntem = t => t.replace(/\bhoje\b/g, 'ontem').replace(/\bHoje\b/g, 'Ontem');
    tituloFinal = paraOntem(titulo); aberturaFinal = paraOntem(abertura); textoFinal = paraOntem(textoFinal);
    fechoFinal = paraOntem(fecho); obsFinal = obsFinal.map(paraOntem);
  }
  return {
    titulo: tituloFinal, abertura: aberturaFinal, texto: textoFinal, destaque: trechoDestaque,
    observacoes: obsFinal, conselhos, fecho: fechoFinal,
    contagem: ordenadas, total: n, escritas: posts.length,
    saudacao: ontem ? 'seu dia de ontem' : 'seu dia',
  };
}

// ---------- quando o card aparece ----------
// Só à noite: a partir de 30min antes do horário de dormir da pessoa (o mesmo momento da notificação)
// e até a hora de acordar. Os horários são guardados em MINUTOS desde a meia-noite (22h30 = 1350).
// Devolve null fora da janela; dentro dela, o dia que está sendo resumido e o intervalo pra buscar.
function janelaResumoDia(agora, dormirMin, acordarMin) {
  // "% 1440 + 1440) % 1440" evita número negativo (1440 = minutos de um dia)
  const inicioMin = ((dormirMin - 30) % 1440 + 1440) % 1440;
  const duracao = Math.max(120, ((acordarMin - inicioMin) % 1440 + 1440) % 1440);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  if (((agoraMin - inicioMin) % 1440 + 1440) % 1440 >= duracao) return null;

  const abertura = new Date(agora); abertura.setHours(0, 0, 0, 0);
  if (agoraMin < inicioMin) abertura.setDate(abertura.getDate() - 1); // a janela abriu ontem
  // quem dorme depois da meia-noite (janela abre de madrugada) está fechando o dia anterior
  const dormeDepoisDaMeiaNoite = inicioMin < 360;
  const dia = new Date(abertura); if (dormeDepoisDaMeiaNoite) dia.setDate(dia.getDate() - 1);
  const fim = new Date(dia); fim.setDate(fim.getDate() + 1);
  if (dormeDepoisDaMeiaNoite) fim.setHours(6, 0, 0, 0);
  const hoje0 = new Date(agora); hoje0.setHours(0, 0, 0, 0);
  return { inicio: dia, fim, diaISO: fmtDataISO(dia), diaJaVirou: hoje0.getTime() !== dia.getTime() };
}

// cria um elemento com texto (textContent nunca interpreta HTML, então é seguro com texto do usuário)
function elTexto(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  el.textContent = texto;
  return el;
}

async function carregarResumoDia() {
  const wrap = document.getElementById('homeResumoWrap');
  if (!wrap) return;
  const janela = janelaResumoDia(new Date(), horarioDormirMin, horarioAcordarMin);
  if (!janela) { wrap.style.display = 'none'; return; }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData || !sessionData.session) return;
  const meuId = sessionData.session.user.id;

  const semanaAntes = new Date(janela.inicio); semanaAntes.setDate(semanaAntes.getDate() - 7);
  const [respEventos, respPosts, respLeitura, respSemana] = await Promise.all([
    supabaseClient.from('humor_eventos').select('emocao, criado_em').eq('usuario_id', meuId).gte('criado_em', janela.inicio.toISOString()).lt('criado_em', janela.fim.toISOString()).order('criado_em', { ascending: true }),
    supabaseClient.from('posts').select('texto, tipo, privado, criado_em').eq('autor_id', meuId).is('clube_id', null).gte('criado_em', janela.inicio.toISOString()).lt('criado_em', janela.fim.toISOString()),
    supabaseClient.from('logs_leitura').select('data', { count: 'exact', head: true }).eq('usuario_id', meuId).eq('data', janela.diaISO),
    supabaseClient.from('humor_eventos').select('emocao, criado_em').eq('usuario_id', meuId).gte('criado_em', semanaAntes.toISOString()).lt('criado_em', janela.inicio.toISOString()),
  ]);
  const eventos = respEventos.data || [];
  const posts = (respPosts.data || []).filter(p => String(p.texto || '').trim());
  if (!eventos.length && !posts.length) { wrap.style.display = 'none'; return; }

  const r = montarResumoDoDia({
    eventos, posts, leuHoje: (respLeitura.count || 0) > 0, ontem: janela.diaJaVirou,
    semana: respSemana.data || [], sequencia: streakAtual,
    domingo: janela.inicio.getDay() === 0, // o dia resumido é domingo: entra o resumo da semana
  });
  window.RESUMO_DIA_ATUAL = r;

  // ---- desenha o card ----
  document.getElementById('resumoDiaRotulo').textContent = r.saudacao;
  document.getElementById('resumoDiaTitulo').textContent = r.titulo;
  document.getElementById('resumoDiaAbertura').textContent = r.abertura;

  document.getElementById('resumoDiaBarra').innerHTML = r.total
    ? r.contagem.map(([emo, qtd]) => `<span class="home-resumo-barra-seg" style="flex:${qtd}; background:${HUMOR_CORES[emo] || 'var(--accent-a)'};" title="${SUBSTANTIVO_HUMOR[emo]}: ${qtd}"></span>`).join('')
    : '';
  document.getElementById('resumoDiaBarraLegenda').innerHTML = r.total
    ? r.contagem.map(([emo, qtd]) => `<span class="home-resumo-leg"><i style="background:${HUMOR_CORES[emo] || 'var(--accent-a)'};"></i>${SUBSTANTIVO_HUMOR[emo]} ${qtd}</span>`).join('')
    : '';
  document.getElementById('resumoDiaBarraWrap').style.display = r.total ? '' : 'none';

  document.getElementById('resumoDiaTexto').textContent = r.texto;
  const elDestaque = document.getElementById('resumoDiaDestaque');
  if (r.destaque) { elDestaque.textContent = '“' + r.destaque + '”'; elDestaque.style.display = ''; } else { elDestaque.style.display = 'none'; }

  const stats = [];
  if (r.total) stats.push({ n: r.total, l: r.total === 1 ? 'momento' : 'momentos', ic: 'sol' });
  if (r.escritas) stats.push({ n: r.escritas, l: r.escritas === 1 ? 'escrita' : 'escritas', ic: 'editar' });
  stats.push({ n: streakAtual, l: streakAtual === 1 ? 'dia seguido' : 'dias seguidos', ic: 'fogo' });
  document.getElementById('resumoDiaStats').innerHTML = stats.map(s => `<div class="home-resumo-stat">${icone(s.ic, 12)} ${s.n} ${s.l}</div>`).join('');

  const blocoObs = document.getElementById('resumoDiaObservacoes');
  blocoObs.innerHTML = '';
  if (r.observacoes.length) {
    blocoObs.appendChild(elTexto('div', 'home-resumo-secao', 'o que eu reparei'));
    r.observacoes.forEach(o => blocoObs.appendChild(elTexto('div', 'home-resumo-obs', o)));
  }
  blocoObs.style.display = r.observacoes.length ? '' : 'none';

  const blocoCons = document.getElementById('resumoDiaConselhos');
  blocoCons.innerHTML = '';
  blocoCons.appendChild(elTexto('div', 'home-resumo-secao', 'pra essa noite'));
  r.conselhos.forEach(c => {
    const item = document.createElement('div');
    item.className = 'home-resumo-conselho';
    item.appendChild(elTexto('div', 'home-resumo-conselho-t', c.t));
    item.appendChild(elTexto('div', 'home-resumo-conselho-o', c.o));
    item.appendChild(elTexto('div', 'home-resumo-conselho-p', 'por quê: ' + c.p));
    blocoCons.appendChild(item);
  });

  document.getElementById('resumoDiaFecho').textContent = r.fecho;
  wrap.style.display = '';
}
