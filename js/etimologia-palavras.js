/* js/etimologia-palavras.js — As palavras do dia (só dados, sem lógica)
   Script comum (sem módulo).

   Cada palavra é uma "árvore genealógica":
     p      → a palavra
     classe → classe gramatical
     sig    → significado de hoje
     raiz   → a linhagem, da forma MAIS RECENTE pra MAIS ANTIGA
              (cada passo: f = forma, l = língua, s = o que queria dizer)
     fundo  → o "significado profundo": o que a raiz ensina sobre a palavra
     familia→ palavras-primas, que vêm da mesma raiz
     nota   → (opcional) quando a origem é discutida ou existe uma lenda famosa
   Todo texto tem { pt, en }. A palavra continua em português nos dois idiomas
   (é ela que a pessoa está aprendendo), só as explicações mudam.

   IMPORTANTE: etimologia tem muita lenda circulando na internet. Aqui só
   entra origem bem estabelecida em dicionários etimológicos; quando os
   estudiosos discordam, a "nota" diz isso. Antes de acrescentar uma palavra,
   confira em mais de uma fonte (ex: Houaiss, Dicionário Etimológico de
   Antônio Geraldo da Cunha, etymonline.com pra raízes latinas e gregas). */

const LINGUAS_ETIMO = {
  latim: { pt: 'latim', en: 'Latin' },
  grego: { pt: 'grego', en: 'Greek' },
  ptAntigo: { pt: 'português antigo', en: 'Old Portuguese' },
  latimVulgar: { pt: 'latim vulgar', en: 'Vulgar Latin' },
  italiano: { pt: 'italiano', en: 'Italian' },
  fenicio: { pt: 'fenício', en: 'Phoenician' }
};

const PALAVRAS_ETIMOLOGIA = [
  {
    p: 'saudade', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Sentimento de falta de alguém, de um lugar ou de um tempo que a gente quer de volta.', en: 'The feeling of missing someone, a place or a time you wish would come back.' },
    raiz: [
      { f: 'soidade / suidade', l: LINGUAS_ETIMO.ptAntigo, s: { pt: 'solidão', en: 'loneliness' } },
      { f: 'solitas, solitatis', l: LINGUAS_ETIMO.latim, s: { pt: 'solidão, estar só', en: 'solitude, being alone' } },
      { f: 'solus', l: LINGUAS_ETIMO.latim, s: { pt: 'só, sozinho', en: 'alone' } }
    ],
    fundo: { pt: 'Na raiz, saudade é solidão: o vazio que fica quando alguém ou algo falta. Com o tempo a palavra ficou mais doce — virou a solidão que lembra com carinho.', en: 'At its root, saudade is solitude: the emptiness left when someone or something is missing. Over time it softened into a loneliness that remembers with tenderness.' },
    familia: ['solidão', 'solitário', 'solo', 'solteiro'],
    nota: { pt: 'O "au" no lugar de "oi" provavelmente veio da influência de "saudar" e "saúde".', en: 'The "au" replacing "oi" probably came from the influence of "saudar" (to greet) and "saúde" (health).' }
  },
  {
    p: 'companheiro', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Quem está junto, acompanha, divide o caminho.', en: 'Someone who is with you, who shares the way.' },
    raiz: [
      { f: 'companion', l: { pt: 'francês antigo', en: 'Old French' }, s: { pt: 'companheiro', en: 'companion' } },
      { f: 'companio', l: LINGUAS_ETIMO.latimVulgar, s: { pt: 'quem come o pão junto', en: 'one who eats bread with you' } },
      { f: 'com + panis', l: LINGUAS_ETIMO.latim, s: { pt: 'com + pão', en: 'with + bread' } }
    ],
    fundo: { pt: 'Companheiro é, literalmente, quem divide o pão com você. A amizade nasce na mesa.', en: 'A companion is, literally, someone who shares bread with you. Friendship is born at the table.' },
    familia: ['companhia', 'acompanhar', 'compañero', 'companion', 'pão', 'padaria']
  },
  {
    p: 'desastre', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Acontecimento ruim, desgraça, acidente.', en: 'A terrible event, a calamity, an accident.' },
    raiz: [
      { f: 'disastro', l: LINGUAS_ETIMO.italiano, s: { pt: 'má sorte', en: 'misfortune' } },
      { f: 'dis + astro', l: LINGUAS_ETIMO.italiano, s: { pt: 'contra + estrela', en: 'against + star' } },
      { f: 'astrum', l: LINGUAS_ETIMO.latim, s: { pt: 'astro, estrela', en: 'star' } }
    ],
    fundo: { pt: 'Desastre é estar com a estrela contra você. A palavra guarda o tempo em que se acreditava que os astros decidiam a sorte.', en: 'A disaster is having your star against you. The word keeps the memory of a time when people believed the stars decided our fate.' },
    familia: ['astro', 'astronomia', 'asterisco', 'desastrado']
  },
  {
    p: 'entusiasmo', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Animação intensa, vontade, empolgação.', en: 'Intense excitement, eagerness.' },
    raiz: [
      { f: 'enthusiasmus', l: LINGUAS_ETIMO.latim, s: { pt: 'inspiração divina', en: 'divine inspiration' } },
      { f: 'enthousiasmós', l: LINGUAS_ETIMO.grego, s: { pt: 'estar possuído por um deus', en: 'being possessed by a god' } },
      { f: 'en + theós', l: LINGUAS_ETIMO.grego, s: { pt: 'dentro + deus', en: 'in + god' } }
    ],
    fundo: { pt: 'Para os gregos, quem estava entusiasmado tinha um deus dentro de si. A empolgação era vista como algo sagrado.', en: 'For the Greeks, an enthusiastic person had a god inside them. Excitement was seen as something sacred.' },
    familia: ['teologia', 'ateu', 'panteão', 'entusiasta']
  },
  {
    p: 'palavra', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Unidade da língua que tem sentido; também promessa ("dar a palavra").', en: 'A unit of language with meaning; also a promise ("to give your word").' },
    raiz: [
      { f: 'parabola', l: LINGUAS_ETIMO.latim, s: { pt: 'comparação, discurso', en: 'comparison, speech' } },
      { f: 'parabolé', l: LINGUAS_ETIMO.grego, s: { pt: 'pôr lado a lado, comparar', en: 'placing side by side' } },
      { f: 'pará + bállein', l: LINGUAS_ETIMO.grego, s: { pt: 'ao lado + lançar', en: 'beside + to throw' } }
    ],
    fundo: { pt: 'Palavra é a mesma raiz de parábola: algo que você lança ao lado de outra coisa para que ela seja entendida. Falar é comparar.', en: 'Palavra shares its root with "parable": something you throw beside another thing so it can be understood. To speak is to compare.' },
    familia: ['parábola', 'parabólica', 'palavrão', 'parole']
  },
  {
    p: 'livro', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Conjunto de folhas escritas, presas juntas.', en: 'A set of written pages bound together.' },
    raiz: [
      { f: 'liber, libri', l: LINGUAS_ETIMO.latim, s: { pt: 'livro', en: 'book' } },
      { f: 'liber', l: LINGUAS_ETIMO.latim, s: { pt: 'a parte de dentro da casca da árvore', en: 'the inner bark of a tree' } }
    ],
    fundo: { pt: 'Antes do papel, escrevia-se na película de dentro da casca das árvores. Todo livro ainda carrega uma árvore no nome.', en: 'Before paper, people wrote on the thin inner layer of tree bark. Every book still carries a tree in its name.' },
    familia: ['livraria', 'libreto', 'library (inglês)', 'librairie (francês)']
  },
  {
    p: 'escola', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Lugar onde se ensina e se aprende.', en: 'A place where people teach and learn.' },
    raiz: [
      { f: 'schola', l: LINGUAS_ETIMO.latim, s: { pt: 'lição, lugar de estudo', en: 'lesson, place of study' } },
      { f: 'scholé', l: LINGUAS_ETIMO.grego, s: { pt: 'tempo livre, lazer', en: 'free time, leisure' } }
    ],
    fundo: { pt: 'Para os gregos, estudar era o melhor uso do tempo livre: só quem não precisava trabalhar o dia todo podia conversar e pensar. Escola era o ócio que vira conhecimento.', en: 'For the Greeks, study was the best use of free time: only those who didn\'t have to work all day could talk and think. School was leisure turned into knowledge.' },
    familia: ['escolar', 'escolástica', 'school (inglês)', 'école (francês)']
  },
  {
    p: 'inteligência', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Capacidade de compreender, aprender e resolver.', en: 'The ability to understand, learn and solve.' },
    raiz: [
      { f: 'intelligentia', l: LINGUAS_ETIMO.latim, s: { pt: 'compreensão', en: 'understanding' } },
      { f: 'intelligere', l: LINGUAS_ETIMO.latim, s: { pt: 'perceber, entender', en: 'to perceive, to understand' } },
      { f: 'inter + legere', l: LINGUAS_ETIMO.latim, s: { pt: 'entre + escolher, ler', en: 'between + to choose, to read' } }
    ],
    fundo: { pt: 'Ser inteligente é saber escolher entre as coisas — ler nas entrelinhas. Não é saber tudo, é saber separar.', en: 'Being intelligent is knowing how to choose between things — reading between the lines. It isn\'t knowing everything, it\'s knowing how to tell apart.' },
    familia: ['ler', 'eleger', 'seleção', 'legível', 'lenda']
  },
  {
    p: 'recordar', classe: { pt: 'verbo', en: 'verb' },
    sig: { pt: 'Trazer de volta à memória, lembrar.', en: 'To bring back to memory, to remember.' },
    raiz: [
      { f: 'recordari', l: LINGUAS_ETIMO.latim, s: { pt: 'lembrar-se', en: 'to remember' } },
      { f: 're + cor, cordis', l: LINGUAS_ETIMO.latim, s: { pt: 'de novo + coração', en: 'again + heart' } }
    ],
    fundo: { pt: 'Os romanos achavam que a memória morava no coração. Recordar é passar algo pelo coração de novo — por isso em inglês ainda se diz "learn by heart".', en: 'The Romans believed memory lived in the heart. To recall (recordar) is to pass something through the heart again — that\'s why English still says "learn by heart".' },
    familia: ['coração', 'cordial', 'concordar', 'discordar', 'coragem']
  },
  {
    p: 'paciência', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Capacidade de esperar e suportar com calma.', en: 'The ability to wait and endure calmly.' },
    raiz: [
      { f: 'patientia', l: LINGUAS_ETIMO.latim, s: { pt: 'resistência, capacidade de suportar', en: 'endurance' } },
      { f: 'pati', l: LINGUAS_ETIMO.latim, s: { pt: 'sofrer, aguentar', en: 'to suffer, to endure' } }
    ],
    fundo: { pt: 'Paciência, paciente e paixão nascem do mesmo verbo: sofrer. Ter paciência é aceitar atravessar um desconforto sem fugir dele.', en: 'Patience, patient and passion are born from the same verb: to suffer. Being patient is accepting to go through discomfort without running from it.' },
    familia: ['paciente', 'paixão', 'passivo', 'compaixão']
  },
  {
    p: 'sincero', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Que diz o que sente, verdadeiro, franco.', en: 'Someone who says what they feel; true, honest.' },
    raiz: [
      { f: 'sincerus', l: LINGUAS_ETIMO.latim, s: { pt: 'puro, limpo, sem mistura', en: 'pure, clean, unmixed' } }
    ],
    fundo: { pt: 'Ser sincero é ser puro como algo que não foi misturado com nada. Nada de falso adicionado por cima.', en: 'Being sincere is being pure like something that hasn\'t been mixed with anything. Nothing false added on top.' },
    familia: ['sinceridade', 'sincere (inglês)'],
    nota: { pt: 'Circula a história de que viria de "sine cera" (sem cera, de esculturas sem rachaduras disfarçadas). É lenda: os dicionários etimológicos não aceitam essa origem.', en: 'There\'s a popular story that it comes from "sine cera" (without wax, from sculptures with no hidden cracks). It\'s a legend: etymological dictionaries don\'t accept it.' }
  },
  {
    p: 'nostalgia', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Saudade do passado, de um tempo que não volta.', en: 'Longing for the past, for a time that won\'t return.' },
    raiz: [
      { f: 'nostalgia', l: { pt: 'latim científico (1688)', en: 'scientific Latin (1688)' }, s: { pt: 'doença da saudade de casa', en: 'homesickness as an illness' } },
      { f: 'nóstos + álgos', l: LINGUAS_ETIMO.grego, s: { pt: 'volta pra casa + dor', en: 'homecoming + pain' } }
    ],
    fundo: { pt: 'Nostalgia é a dor de querer voltar pra casa. O médico suíço Johannes Hofer inventou a palavra em 1688 para descrever soldados doentes de saudade.', en: 'Nostalgia is the pain of wanting to go home. Swiss doctor Johannes Hofer coined the word in 1688 to describe soldiers sick with homesickness.' },
    familia: ['nevralgia', 'analgésico', 'nostálgico']
  },
  {
    p: 'planeta', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Corpo celeste que gira ao redor de uma estrela.', en: 'A celestial body orbiting a star.' },
    raiz: [
      { f: 'planeta', l: LINGUAS_ETIMO.latim, s: { pt: 'astro errante', en: 'wandering star' } },
      { f: 'planétes', l: LINGUAS_ETIMO.grego, s: { pt: 'o que vagueia, andarilho', en: 'wanderer' } }
    ],
    fundo: { pt: 'Olhando o céu, os gregos viam estrelas paradas e alguns pontos que mudavam de lugar. Esses eram os "andarilhos": os planetas.', en: 'Looking at the sky, the Greeks saw fixed stars and a few points that moved around. Those were the "wanderers": the planets.' },
    familia: ['planetário', 'plâncton (o que vaga no mar)']
  },
  {
    p: 'música', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Arte de combinar sons no tempo.', en: 'The art of combining sounds in time.' },
    raiz: [
      { f: 'musica', l: LINGUAS_ETIMO.latim, s: { pt: 'música', en: 'music' } },
      { f: 'mousiké (tékhne)', l: LINGUAS_ETIMO.grego, s: { pt: 'a arte das Musas', en: 'the art of the Muses' } },
      { f: 'Moûsa', l: LINGUAS_ETIMO.grego, s: { pt: 'Musa, deusa da inspiração', en: 'Muse, goddess of inspiration' } }
    ],
    fundo: { pt: 'Música é a arte das Musas, as nove deusas que inspiravam poesia, dança, história e astronomia. Para os gregos, toda criação era um presente delas.', en: 'Music is the art of the Muses, the nine goddesses who inspired poetry, dance, history and astronomy. For the Greeks, every creation was their gift.' },
    familia: ['museu (casa das Musas)', 'musa', 'musical']
  },
  {
    p: 'horizonte', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'A linha onde o céu parece encontrar a terra ou o mar.', en: 'The line where the sky seems to meet the land or the sea.' },
    raiz: [
      { f: 'horizon', l: LINGUAS_ETIMO.latim, s: { pt: 'horizonte', en: 'horizon' } },
      { f: 'horízon (kýklos)', l: LINGUAS_ETIMO.grego, s: { pt: 'o círculo que limita', en: 'the bounding circle' } },
      { f: 'horízein', l: LINGUAS_ETIMO.grego, s: { pt: 'delimitar, marcar fronteira', en: 'to bound, to mark a border' } }
    ],
    fundo: { pt: 'Horizonte é o limite do que os olhos alcançam. Ampliar horizontes é, literalmente, empurrar a sua fronteira.', en: 'The horizon is the limit of what your eyes can reach. Broadening your horizons is literally pushing your border further.' },
    familia: ['horizontal', 'aforismo (definição curta)']
  },
  {
    p: 'ideia', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Pensamento, imagem que se forma na mente.', en: 'A thought, an image formed in the mind.' },
    raiz: [
      { f: 'idea', l: LINGUAS_ETIMO.latim, s: { pt: 'ideia, modelo', en: 'idea, model' } },
      { f: 'idéa', l: LINGUAS_ETIMO.grego, s: { pt: 'forma, aparência', en: 'form, appearance' } },
      { f: 'ideîn', l: LINGUAS_ETIMO.grego, s: { pt: 'ver', en: 'to see' } }
    ],
    fundo: { pt: 'Ter uma ideia é ver. Por isso a gente diz "agora eu vejo" quando entende algo — e por isso o símbolo da ideia é uma lâmpada acendendo.', en: 'Having an idea is seeing. That\'s why we say "now I see" when we understand something — and why the symbol of an idea is a light bulb turning on.' },
    familia: ['ideal', 'ídolo', 'vídeo (lat. videre, mesma raiz antiga)']
  },
  {
    p: 'candidato', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Quem disputa um cargo, uma vaga ou um prêmio.', en: 'Someone running for a position, a job or a prize.' },
    raiz: [
      { f: 'candidatus', l: LINGUAS_ETIMO.latim, s: { pt: 'vestido de branco', en: 'dressed in white' } },
      { f: 'candidus', l: LINGUAS_ETIMO.latim, s: { pt: 'branco brilhante, puro', en: 'shining white, pure' } }
    ],
    fundo: { pt: 'Em Roma, quem pedia um cargo público andava com a toga clareada de branco, para parecer honesto. Candidato é "o de branco".', en: 'In Rome, those running for public office wore a toga whitened to look honest. A candidate is "the one in white".' },
    familia: ['cândido', 'candura', 'candidatura']
  },
  {
    p: 'aluno', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Quem estuda, quem recebe ensino.', en: 'Someone who studies, who is taught.' },
    raiz: [
      { f: 'alumnus', l: LINGUAS_ETIMO.latim, s: { pt: 'criado, alimentado', en: 'nourished, raised' } },
      { f: 'alere', l: LINGUAS_ETIMO.latim, s: { pt: 'alimentar, nutrir, fazer crescer', en: 'to nourish, to make grow' } }
    ],
    fundo: { pt: 'Aluno é quem está sendo nutrido. Aprender é ser alimentado — e ensinar é alimentar alguém.', en: 'A student (aluno) is someone being nourished. Learning is being fed — and teaching is feeding someone.' },
    familia: ['alimento', 'alumni (ex-alunos)', 'altivo'],
    nota: { pt: 'Circula que "aluno" viria de "a-" + "lumen" (sem luz). É falso: a palavra vem de alere, nutrir.', en: 'There\'s a popular claim that "aluno" comes from "a-" + "lumen" (without light). It\'s false: it comes from alere, to nourish.' }
  },
  {
    p: 'respeito', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Consideração, atenção e cuidado com alguém ou algo.', en: 'Regard, attention and care for someone or something.' },
    raiz: [
      { f: 'respectus', l: LINGUAS_ETIMO.latim, s: { pt: 'olhar para trás, consideração', en: 'looking back, regard' } },
      { f: 're + specere', l: LINGUAS_ETIMO.latim, s: { pt: 'de novo + olhar', en: 'again + to look' } }
    ],
    fundo: { pt: 'Respeitar é olhar de novo. É não ficar na primeira impressão: dar a alguém uma segunda olhada, com mais atenção.', en: 'To respect is to look again. It\'s not stopping at the first impression: giving someone a second, more attentive look.' },
    familia: ['espectador', 'espelho', 'aspecto', 'perspectiva', 'suspeita']
  },
  {
    p: 'obrigado', classe: { pt: 'interjeição', en: 'interjection' },
    sig: { pt: 'Forma de agradecer.', en: 'A way of saying thank you.' },
    raiz: [
      { f: 'obrigar', l: { pt: 'português', en: 'Portuguese' }, s: { pt: 'ficar ligado a alguém por um favor', en: 'to be bound to someone by a favor' } },
      { f: 'obligare', l: LINGUAS_ETIMO.latim, s: { pt: 'amarrar, comprometer', en: 'to tie, to bind' } },
      { f: 'ob + ligare', l: LINGUAS_ETIMO.latim, s: { pt: 'diante de + ligar, atar', en: 'toward + to tie' } }
    ],
    fundo: { pt: 'Quem diz "obrigado" está dizendo "fiquei ligado a você pelo que você fez". Agradecer é admitir um laço.', en: 'Saying "obrigado" means "I\'m now bound to you for what you did". Thanking is admitting a bond.' },
    familia: ['obrigação', 'ligar', 'liga', 'religião (segundo uma das explicações)']
  },
  {
    p: 'trabalho', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Atividade, esforço para produzir algo; emprego.', en: 'Activity, effort to produce something; a job.' },
    raiz: [
      { f: 'trabalhar', l: LINGUAS_ETIMO.ptAntigo, s: { pt: 'sofrer, esforçar-se', en: 'to suffer, to toil' } },
      { f: 'tripaliare', l: LINGUAS_ETIMO.latimVulgar, s: { pt: 'torturar', en: 'to torture' } },
      { f: 'tripalium', l: LINGUAS_ETIMO.latim, s: { pt: 'instrumento de três paus', en: 'a device made of three stakes' } }
    ],
    fundo: { pt: 'Na explicação mais aceita, trabalho vem de um instrumento de três paus usado para prender animais e castigar pessoas. Por séculos, trabalhar foi sinônimo de sofrer — o sentido de "ofício" veio depois.', en: 'In the most accepted explanation, trabalho comes from a three-stake device used to restrain animals and punish people. For centuries, working meant suffering — the sense of "occupation" came later.' },
    familia: ['trabalhador', 'travail (francês)', 'travel (inglês: viajar era sofrido!)'],
    nota: { pt: 'Essa origem é a mais aceita pelos dicionários, mas alguns estudiosos ainda discutem.', en: 'This is the origin most dictionaries accept, but some scholars still debate it.' }
  },
  {
    p: 'salário', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Pagamento recebido pelo trabalho.', en: 'Payment received for work.' },
    raiz: [
      { f: 'salarium', l: LINGUAS_ETIMO.latim, s: { pt: 'pagamento, ajuda de custo', en: 'payment, allowance' } },
      { f: 'sal', l: LINGUAS_ETIMO.latim, s: { pt: 'sal', en: 'salt' } }
    ],
    fundo: { pt: 'Salário vem de sal. O sal conservava a comida e era valioso: o salário dos romanos estava ligado a ele de alguma forma.', en: 'Salary comes from salt. Salt preserved food and was precious: the Roman salarium was linked to it somehow.' },
    familia: ['sal', 'salada (verdura temperada com sal)', 'salgado', 'salsicha'],
    nota: { pt: 'A ligação com o sal é certa. Já a história de que os soldados eram pagos em sal é uma tradição sem prova firme — pode ter sido um dinheiro para comprar sal, ou outra coisa.', en: 'The link to salt is certain. The story that soldiers were paid in salt is a tradition without firm proof — it may have been money to buy salt, or something else.' }
  },
  {
    p: 'alfabeto', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Conjunto das letras de uma língua, em ordem.', en: 'The set of letters of a language, in order.' },
    raiz: [
      { f: 'alphabetum', l: LINGUAS_ETIMO.latim, s: { pt: 'alfabeto', en: 'alphabet' } },
      { f: 'álpha + bêta', l: LINGUAS_ETIMO.grego, s: { pt: 'as duas primeiras letras', en: 'the first two letters' } },
      { f: 'aleph + bet', l: LINGUAS_ETIMO.fenicio, s: { pt: 'boi + casa', en: 'ox + house' } }
    ],
    fundo: { pt: 'O alfabeto se chama pelas suas duas primeiras letras, como quem diz "o á-bê-cê". E lá no fenício elas eram desenhos: a cabeça de um boi e uma casa.', en: 'The alphabet is named after its first two letters, like saying "the ABC". And in Phoenician they were pictures: an ox\'s head and a house.' },
    familia: ['analfabeto', 'alfabetizar', 'beta']
  },
  {
    p: 'biblioteca', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Lugar ou coleção onde se guardam livros.', en: 'A place or collection where books are kept.' },
    raiz: [
      { f: 'bibliotheca', l: LINGUAS_ETIMO.latim, s: { pt: 'coleção de livros', en: 'collection of books' } },
      { f: 'biblíon + théke', l: LINGUAS_ETIMO.grego, s: { pt: 'livro + caixa, depósito', en: 'book + box, storage' } },
      { f: 'Býblos', l: LINGUAS_ETIMO.grego, s: { pt: 'cidade fenícia que vendia papiro', en: 'Phoenician city that traded papyrus' } }
    ],
    fundo: { pt: 'Biblioteca é a caixa dos livros. E "livro" em grego veio do nome de uma cidade, Biblos, por onde passava o papiro. A Bíblia tem a mesma raiz: "os livros".', en: 'A library (biblioteca) is the box of books. And "book" in Greek came from the name of a city, Byblos, where papyrus was traded. The Bible shares the root: "the books".' },
    familia: ['Bíblia', 'bibliografia', 'discoteca', 'pinacoteca']
  },
  {
    p: 'considerar', classe: { pt: 'verbo', en: 'verb' },
    sig: { pt: 'Pensar com cuidado, levar em conta; ter apreço.', en: 'To think carefully, take into account; to hold in regard.' },
    raiz: [
      { f: 'considerare', l: LINGUAS_ETIMO.latim, s: { pt: 'examinar com atenção', en: 'to examine closely' } },
      { f: 'com + sidus, sideris', l: LINGUAS_ETIMO.latim, s: { pt: 'com + estrela, astro', en: 'with + star' } }
    ],
    fundo: { pt: 'Considerar seria olhar os astros com atenção, como faziam os antigos antes de decidir algo importante. Desejar tem a mesma estrela: "de-siderare", sentir falta de uma estrela.', en: 'To consider would be to watch the stars carefully, as the ancients did before an important decision. Desire shares the star: "de-siderare", to miss a star.' },
    familia: ['desejar', 'sideral', 'consideração'],
    nota: { pt: 'A ligação com "sidus" (estrela) é a explicação mais citada, mas não é unanimidade entre os estudiosos.', en: 'The link to "sidus" (star) is the most cited explanation, but scholars don\'t fully agree.' }
  },
  {
    p: 'amigo', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Pessoa com quem se tem afeto e confiança.', en: 'A person you share affection and trust with.' },
    raiz: [
      { f: 'amicus', l: LINGUAS_ETIMO.latim, s: { pt: 'amigo', en: 'friend' } },
      { f: 'amare', l: LINGUAS_ETIMO.latim, s: { pt: 'amar', en: 'to love' } }
    ],
    fundo: { pt: 'Amigo e amor são a mesma família. Amizade, na raiz, é um jeito de amar.', en: 'Amigo (friend) and amor (love) are the same family. Friendship, at its root, is a way of loving.' },
    familia: ['amor', 'amável', 'amizade', 'amador (quem faz por amor)']
  },
  {
    p: 'vocação', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Inclinação natural para uma atividade ou caminho.', en: 'A natural calling toward an activity or path.' },
    raiz: [
      { f: 'vocatio', l: LINGUAS_ETIMO.latim, s: { pt: 'chamado, convocação', en: 'a calling, summons' } },
      { f: 'vocare', l: LINGUAS_ETIMO.latim, s: { pt: 'chamar', en: 'to call' } },
      { f: 'vox, vocis', l: LINGUAS_ETIMO.latim, s: { pt: 'voz', en: 'voice' } }
    ],
    fundo: { pt: 'Vocação é um chamado: uma voz que te chama para um caminho. Encontrar a vocação é ouvir essa voz.', en: 'A vocation is a calling: a voice that calls you toward a path. Finding your vocation is hearing that voice.' },
    familia: ['voz', 'vogal', 'evocar', 'provocar', 'vocabulário']
  },
  {
    p: 'sarcasmo', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Ironia cruel, zombaria que fere.', en: 'Cruel irony, mockery that hurts.' },
    raiz: [
      { f: 'sarcasmus', l: LINGUAS_ETIMO.latim, s: { pt: 'sarcasmo', en: 'sarcasm' } },
      { f: 'sarkasmós', l: LINGUAS_ETIMO.grego, s: { pt: 'zombaria amarga', en: 'bitter mockery' } },
      { f: 'sarkázein', l: LINGUAS_ETIMO.grego, s: { pt: 'rasgar a carne', en: 'to tear flesh' } }
    ],
    fundo: { pt: 'O sarcasmo morde: na raiz, é rasgar a carne como um animal faz. A palavra lembra que certas brincadeiras machucam de verdade.', en: 'Sarcasm bites: at its root it means tearing flesh like an animal does. The word reminds us some jokes truly hurt.' },
    familia: ['sarcófago (que come a carne)', 'sarcoma']
  },
  {
    p: 'ilustre', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Famoso, notável, que se destaca.', en: 'Famous, notable, distinguished.' },
    raiz: [
      { f: 'illustris', l: LINGUAS_ETIMO.latim, s: { pt: 'claro, brilhante, notável', en: 'bright, shining, notable' } },
      { f: 'in + lustrare', l: LINGUAS_ETIMO.latim, s: { pt: 'em + iluminar', en: 'in + to illuminate' } },
      { f: 'lux, lucis', l: LINGUAS_ETIMO.latim, s: { pt: 'luz', en: 'light' } }
    ],
    fundo: { pt: 'Ilustre é quem está iluminado — quem tem luz própria. E ilustrar um livro é jogar luz sobre o texto.', en: 'Someone illustrious is lit up — someone with their own light. And illustrating a book is shedding light on the text.' },
    familia: ['luz', 'lúcido', 'ilustração', 'lustre', 'elucidar']
  },
  {
    p: 'educação', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Processo de ensinar e aprender; boas maneiras.', en: 'The process of teaching and learning; good manners.' },
    raiz: [
      { f: 'educatio', l: LINGUAS_ETIMO.latim, s: { pt: 'criação, formação', en: 'upbringing, training' } },
      { f: 'educare', l: LINGUAS_ETIMO.latim, s: { pt: 'criar, alimentar, formar', en: 'to raise, to nurture' } },
      { f: 'ex + ducere', l: LINGUAS_ETIMO.latim, s: { pt: 'para fora + conduzir (educere)', en: 'out + to lead (educere)' } }
    ],
    fundo: { pt: 'Educar está ligado a conduzir para fora: ajudar alguém a trazer pra fora o que já tem dentro, e a crescer como quem é criado com cuidado.', en: 'To educate is linked to leading out: helping someone bring out what they already have inside, and grow like someone raised with care.' },
    familia: ['conduzir', 'produzir', 'duque (o que conduz)', 'introduzir'],
    nota: { pt: 'Educare (criar) e educere (conduzir para fora) são verbos irmãos; os dicionários ligam educação ao primeiro, e a imagem de "trazer pra fora" vem do segundo.', en: 'Educare (to raise) and educere (to lead out) are sibling verbs; dictionaries tie education to the first, and the "bring out" image comes from the second.' }
  }
];
