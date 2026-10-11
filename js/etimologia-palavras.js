/* js/etimologia-palavras.js — As palavras do dia (só dados, sem lógica)
   Script comum (sem módulo).

   São palavras mais raras e refinadas do português — do tipo que deixa a
   escrita elegante — pra cada dia ser um pequeno ganho de vocabulário.

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
  fenicio: { pt: 'fenício', en: 'Phoenician' },
  frances: { pt: 'francês', en: 'French' },
  ingles: { pt: 'inglês', en: 'English' },
  arabe: { pt: 'árabe', en: 'Arabic' },
  portugues: { pt: 'português', en: 'Portuguese' }
};

const PALAVRAS_ETIMOLOGIA = [
  {
    p: 'efêmero', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Que dura muito pouco; passageiro, fugaz.', en: 'Lasting a very short time; fleeting.' },
    raiz: [
      { f: 'ephemerus', l: LINGUAS_ETIMO.latim, s: { pt: 'que dura um dia', en: 'lasting a day' } },
      { f: 'ephémeros', l: LINGUAS_ETIMO.grego, s: { pt: 'de um só dia', en: 'of a single day' } },
      { f: 'epí + heméra', l: LINGUAS_ETIMO.grego, s: { pt: 'sobre + dia', en: 'upon + day' } }
    ],
    fundo: { pt: 'Efêmero é o que cabe dentro de um único dia — como os insetos que nascem e morrem entre um nascer e um pôr do sol, que os gregos também chamavam assim.', en: 'Ephemeral is what fits inside a single day — like the insects that are born and die between sunrise and sunset, which the Greeks called by the same name.' },
    familia: ['efeméride', 'hemeroteca (arquivo de jornais diários)']
  },
  {
    p: 'inefável', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Que não se consegue expressar em palavras, de tão intenso ou belo.', en: 'Too intense or beautiful to be put into words.' },
    raiz: [
      { f: 'ineffabilis', l: LINGUAS_ETIMO.latim, s: { pt: 'indizível', en: 'unspeakable' } },
      { f: 'in + effari', l: LINGUAS_ETIMO.latim, s: { pt: 'não + pronunciar', en: 'not + to utter' } },
      { f: 'ex + fari', l: LINGUAS_ETIMO.latim, s: { pt: 'para fora + falar', en: 'out + to speak' } }
    ],
    fundo: { pt: 'Inefável é o que não sai pela boca. Quando a palavra falta, não é pobreza de vocabulário: é que a experiência é maior que a língua.', en: 'Ineffable is what cannot come out of the mouth. When words fail, it isn\'t a poor vocabulary: the experience is bigger than language.' },
    familia: ['fábula', 'fado', 'infante (quem ainda não fala)', 'afável']
  },
  {
    p: 'idiossincrasia', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Jeito de ser muito próprio de uma pessoa; mania, traço particular.', en: 'A way of being that is peculiar to one person; a quirk.' },
    raiz: [
      { f: 'idiosynkrasía', l: LINGUAS_ETIMO.grego, s: { pt: 'temperamento particular', en: 'one\'s own temperament' } },
      { f: 'ídios + sýn + krâsis', l: LINGUAS_ETIMO.grego, s: { pt: 'próprio + junto + mistura', en: 'own + together + mixture' } }
    ],
    fundo: { pt: 'Para os médicos gregos, cada pessoa era uma mistura única de humores. A idiossincrasia é a sua receita particular — aquilo que só você tem.', en: 'For Greek physicians, each person was a unique mixture of humors. An idiosyncrasy is your own recipe — what only you have.' },
    familia: ['idioma (o falar próprio de um povo)', 'idiota (na origem, o cidadão comum)', 'cratera (vaso de misturar)']
  },
  {
    p: 'serendipidade', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Descoberta feliz feita por acaso, quando se procurava outra coisa.', en: 'A happy discovery made by chance while looking for something else.' },
    raiz: [
      { f: 'serendipity', l: LINGUAS_ETIMO.ingles, s: { pt: 'palavra criada por Horace Walpole em 1754', en: 'word coined by Horace Walpole in 1754' } },
      { f: 'Serendip', l: { pt: 'nome antigo do Sri Lanka', en: 'old name of Sri Lanka' }, s: { pt: 'do conto "Os Três Príncipes de Serendip"', en: 'from the tale "The Three Princes of Serendip"' } }
    ],
    fundo: { pt: 'No conto, os príncipes viviam achando, por sagacidade e acaso, coisas que não estavam procurando. Serendipidade é o acaso que encontra quem está atento.', en: 'In the tale, the princes kept finding, by wit and chance, things they weren\'t looking for. Serendipity is chance meeting someone who pays attention.' },
    familia: ['serendipitoso']
  },
  {
    p: 'resiliência', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Capacidade de se recuperar e voltar ao próprio eixo depois de um impacto.', en: 'The ability to recover and return to yourself after a blow.' },
    raiz: [
      { f: 'resilientia', l: LINGUAS_ETIMO.latim, s: { pt: 'ato de voltar', en: 'act of springing back' } },
      { f: 'resilire', l: LINGUAS_ETIMO.latim, s: { pt: 'saltar para trás, ricochetear', en: 'to leap back, to rebound' } },
      { f: 're + salire', l: LINGUAS_ETIMO.latim, s: { pt: 'de volta + saltar', en: 'back + to jump' } }
    ],
    fundo: { pt: 'Na física, resiliente é o material que, depois de dobrado, salta de volta à forma. Ser resiliente não é não dobrar: é saber voltar.', en: 'In physics, a resilient material springs back to its shape after bending. Being resilient isn\'t never bending: it\'s knowing how to come back.' },
    familia: ['saltar', 'salto', 'assalto', 'sobressalto']
  },
  {
    p: 'melancolia', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Tristeza vaga e profunda, sem causa definida.', en: 'A deep, vague sadness with no clear cause.' },
    raiz: [
      { f: 'melancholia', l: LINGUAS_ETIMO.latim, s: { pt: 'humor triste', en: 'gloomy humor' } },
      { f: 'melankholía', l: LINGUAS_ETIMO.grego, s: { pt: 'bile negra', en: 'black bile' } },
      { f: 'mélas + kholé', l: LINGUAS_ETIMO.grego, s: { pt: 'negro + bile', en: 'black + bile' } }
    ],
    fundo: { pt: 'A medicina antiga dizia que o corpo tinha quatro humores, e o excesso de bile negra deixava a pessoa triste e pensativa. A palavra ainda carrega essa cor escura.', en: 'Ancient medicine held that the body had four humors, and an excess of black bile made a person sad and pensive. The word still carries that dark color.' },
    familia: ['melanina', 'cólera (de kholé, a bile)', 'colesterol']
  },
  {
    p: 'quimera', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Sonho impossível, fantasia; também um monstro mitológico.', en: 'An impossible dream, a fantasy; also a mythological monster.' },
    raiz: [
      { f: 'chimaera', l: LINGUAS_ETIMO.latim, s: { pt: 'o monstro Quimera', en: 'the monster Chimera' } },
      { f: 'Khímaira', l: LINGUAS_ETIMO.grego, s: { pt: 'cabra jovem; o monstro de corpo misturado', en: 'young she-goat; the mixed-body monster' } }
    ],
    fundo: { pt: 'A Quimera tinha cabeça de leão, corpo de cabra e cauda de serpente: uma criatura impossível. Por isso, quimera virou nome de todo sonho bonito demais para existir.', en: 'The Chimera had a lion\'s head, a goat\'s body and a serpent\'s tail: an impossible creature. So chimera became the name for every dream too beautiful to exist.' },
    familia: ['quimérico']
  },
  {
    p: 'lacônico', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Que fala ou escreve com pouquíssimas palavras.', en: 'Using very few words.' },
    raiz: [
      { f: 'laconicus', l: LINGUAS_ETIMO.latim, s: { pt: 'à maneira dos espartanos', en: 'in the Spartan way' } },
      { f: 'lakonikós', l: LINGUAS_ETIMO.grego, s: { pt: 'da Lacônia, região de Esparta', en: 'of Laconia, the region of Sparta' } }
    ],
    fundo: { pt: 'Os espartanos eram famosos por responder com o mínimo. Conta Plutarco que, ameaçados por um rei com "se eu invadir a Lacônia...", responderam apenas: "Se."', en: 'Spartans were famous for answering with the bare minimum. Plutarch tells that, threatened by a king with "if I invade Laconia...", they replied only: "If."' },
    familia: ['laconismo']
  },
  {
    p: 'epifania', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Compreensão súbita e iluminadora; revelação.', en: 'A sudden, illuminating understanding; a revelation.' },
    raiz: [
      { f: 'epiphania', l: LINGUAS_ETIMO.latim, s: { pt: 'aparição', en: 'appearance' } },
      { f: 'epipháneia', l: LINGUAS_ETIMO.grego, s: { pt: 'manifestação, aparição de um deus', en: 'manifestation, appearance of a god' } },
      { f: 'epí + phaínein', l: LINGUAS_ETIMO.grego, s: { pt: 'sobre + mostrar, fazer brilhar', en: 'upon + to show, to make shine' } }
    ],
    fundo: { pt: 'Epifania é quando algo que estava escondido se mostra de repente, como uma luz que acende. É a mesma raiz de fantasia e de fenômeno: o que aparece.', en: 'An epiphany is when something hidden suddenly shows itself, like a light turning on. Same root as fantasy and phenomenon: what appears.' },
    familia: ['fenômeno', 'fantasia', 'fantasma', 'diáfano']
  },
  {
    p: 'altruísmo', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Amor e cuidado com os outros, sem esperar nada em troca.', en: 'Love and care for others without expecting anything back.' },
    raiz: [
      { f: 'altruisme', l: LINGUAS_ETIMO.frances, s: { pt: 'criada pelo filósofo Auguste Comte no séc. XIX', en: 'coined by philosopher Auguste Comte in the 19th century' } },
      { f: 'altrui', l: LINGUAS_ETIMO.italiano, s: { pt: 'de outrem, dos outros', en: 'of others' } },
      { f: 'alter', l: LINGUAS_ETIMO.latim, s: { pt: 'o outro', en: 'the other' } }
    ],
    fundo: { pt: 'Comte precisava de uma palavra para o oposto do egoísmo e foi buscar o "outro" no latim. Altruísmo é viver também em função do outro.', en: 'Comte needed a word for the opposite of selfishness and found "the other" in Latin. Altruism is living for the other too.' },
    familia: ['alterar', 'alternativa', 'alteridade', 'outro']
  },
  {
    p: 'procrastinar', classe: { pt: 'verbo', en: 'verb' },
    sig: { pt: 'Adiar, deixar para depois o que poderia ser feito agora.', en: 'To put off until later what could be done now.' },
    raiz: [
      { f: 'procrastinare', l: LINGUAS_ETIMO.latim, s: { pt: 'deixar para o dia seguinte', en: 'to put off till tomorrow' } },
      { f: 'pro + crastinus', l: LINGUAS_ETIMO.latim, s: { pt: 'para frente + de amanhã', en: 'forward + of tomorrow' } },
      { f: 'cras', l: LINGUAS_ETIMO.latim, s: { pt: 'amanhã', en: 'tomorrow' } }
    ],
    fundo: { pt: 'Procrastinar é, literalmente, empurrar para amanhã. A palavra já denuncia o truque: amanhã sempre parece um bom lugar para guardar o que pesa hoje.', en: 'To procrastinate is literally to push toward tomorrow. The word gives the trick away: tomorrow always seems a good place to store what weighs today.' },
    familia: ['procrastinação', 'crastino (de amanhã, em português antigo)']
  },
  {
    p: 'pusilânime', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Covarde, sem firmeza de ânimo; o contrário de magnânimo.', en: 'Cowardly, faint-hearted; the opposite of magnanimous.' },
    raiz: [
      { f: 'pusillanimis', l: LINGUAS_ETIMO.latim, s: { pt: 'de alma pequena', en: 'small-souled' } },
      { f: 'pusillus + animus', l: LINGUAS_ETIMO.latim, s: { pt: 'pequenininho + alma, ânimo', en: 'very small + soul, spirit' } }
    ],
    fundo: { pt: 'Pusilânime tem a alma miúda; magnânimo (magnus + animus) tem a alma grande. A coragem, para os romanos, era uma questão de tamanho de alma.', en: 'The pusillanimous has a tiny soul; the magnanimous (magnus + animus) has a great one. For the Romans, courage was a matter of soul size.' },
    familia: ['magnânimo', 'unânime (uma só alma)', 'ânimo', 'animal']
  },
  {
    p: 'diáfano', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Tão fino e leve que deixa a luz passar; transparente, delicado.', en: 'So thin and light it lets light through; sheer, delicate.' },
    raiz: [
      { f: 'diaphanus', l: LINGUAS_ETIMO.latim, s: { pt: 'transparente', en: 'transparent' } },
      { f: 'diaphanés', l: LINGUAS_ETIMO.grego, s: { pt: 'que deixa ver através', en: 'showing through' } },
      { f: 'diá + phaínein', l: LINGUAS_ETIMO.grego, s: { pt: 'através + mostrar', en: 'through + to show' } }
    ],
    fundo: { pt: 'Diáfano é aquilo através do qual se vê: um tecido, uma asa, uma manhã com névoa. É uma palavra que descreve a leveza com precisão.', en: 'Diaphanous is what you can see through: a fabric, a wing, a misty morning. It describes lightness with precision.' },
    familia: ['epifania', 'fenômeno', 'fantasia']
  },
  {
    p: 'etéreo', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Leve, sutil, quase celestial; que parece não pertencer a este mundo.', en: 'Light, subtle, almost heavenly; seemingly not of this world.' },
    raiz: [
      { f: 'aethereus', l: LINGUAS_ETIMO.latim, s: { pt: 'do céu, das alturas', en: 'of the upper sky' } },
      { f: 'aithér', l: LINGUAS_ETIMO.grego, s: { pt: 'o ar puro e luminoso do alto céu', en: 'the pure, bright air of the upper sky' } },
      { f: 'aíthein', l: LINGUAS_ETIMO.grego, s: { pt: 'queimar, brilhar', en: 'to burn, to shine' } }
    ],
    fundo: { pt: 'Os gregos imaginavam que acima do ar comum havia o éter, um ar brilhante onde viviam os deuses. Etéreo é o que parece feito dessa matéria.', en: 'The Greeks imagined that above ordinary air lay the aether, a shining air where the gods lived. Ethereal is what seems made of it.' },
    familia: ['éter', 'Etiópia (na explicação antiga, "rostos queimados")']
  },
  {
    p: 'plácido', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Sereno, tranquilo, sem agitação.', en: 'Serene, calm, undisturbed.' },
    raiz: [
      { f: 'placidus', l: LINGUAS_ETIMO.latim, s: { pt: 'calmo, brando', en: 'calm, gentle' } },
      { f: 'placere', l: LINGUAS_ETIMO.latim, s: { pt: 'agradar', en: 'to please' } }
    ],
    fundo: { pt: 'Plácido e prazer são parentes: a calma, para os romanos, era uma forma de estar agradado — em paz com o que é.', en: 'Placid and pleasure are relatives: for the Romans, calm was a way of being pleased — at peace with what is.' },
    familia: ['prazer', 'aprazível', 'complacente', 'aplacar']
  },
  {
    p: 'iconoclasta', classe: { pt: 'substantivo / adjetivo', en: 'noun / adjective' },
    sig: { pt: 'Quem ataca crenças, tradições ou ídolos estabelecidos.', en: 'Someone who attacks established beliefs, traditions or idols.' },
    raiz: [
      { f: 'eikonoklástes', l: LINGUAS_ETIMO.grego, s: { pt: 'quebrador de imagens', en: 'image breaker' } },
      { f: 'eikón + klân', l: LINGUAS_ETIMO.grego, s: { pt: 'imagem + quebrar', en: 'image + to break' } }
    ],
    fundo: { pt: 'No Império Bizantino, nos séculos VIII e IX, houve quem destruísse as imagens sagradas das igrejas. Hoje o iconoclasta quebra outras imagens: ideias que ninguém ousava questionar.', en: 'In the Byzantine Empire, in the 8th and 9th centuries, some destroyed the sacred images in churches. Today\'s iconoclast breaks other images: ideas nobody dared to question.' },
    familia: ['ícone', 'iconografia', 'clastos (rocha "quebrada", na geologia)']
  },
  {
    p: 'verossímil', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Que parece verdadeiro; plausível.', en: 'Appearing true; plausible.' },
    raiz: [
      { f: 'verisimilis', l: LINGUAS_ETIMO.latim, s: { pt: 'semelhante ao verdadeiro', en: 'like the truth' } },
      { f: 'verus + similis', l: LINGUAS_ETIMO.latim, s: { pt: 'verdadeiro + semelhante', en: 'true + similar' } }
    ],
    fundo: { pt: 'O verossímil não é o verdadeiro: é o que se parece com ele. Toda boa ficção vive aqui — não precisa ter acontecido, precisa parecer que poderia.', en: 'The verisimilar isn\'t the true: it\'s what looks like it. All good fiction lives here — it needn\'t have happened, it must feel like it could.' },
    familia: ['verdade', 'veredito', 'semelhante', 'simular', 'verossimilhança']
  },
  {
    p: 'taciturno', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Calado, de poucas palavras, recolhido em si.', en: 'Silent, of few words, withdrawn.' },
    raiz: [
      { f: 'taciturnus', l: LINGUAS_ETIMO.latim, s: { pt: 'silencioso', en: 'silent' } },
      { f: 'tacere', l: LINGUAS_ETIMO.latim, s: { pt: 'calar-se', en: 'to be silent' } }
    ],
    fundo: { pt: 'O taciturno guarda as palavras. Da mesma raiz vem "tácito": aquilo que fica combinado sem ninguém dizer.', en: 'The taciturn keeps words to themselves. The same root gives "tacit": what is agreed without anyone saying it.' },
    familia: ['tácito', 'reticente (re + tacere)']
  },
  {
    p: 'nefelibata', classe: { pt: 'substantivo / adjetivo', en: 'noun / adjective' },
    sig: { pt: 'Quem vive nas nuvens: sonhador, distraído da realidade.', en: 'Someone who lives in the clouds: a dreamer, detached from reality.' },
    raiz: [
      { f: 'nefelibata', l: { pt: 'português e espanhol, fim do séc. XIX', en: 'Portuguese and Spanish, late 19th century' }, s: { pt: 'apelido de poetas sonhadores', en: 'nickname for dreamy poets' } },
      { f: 'nephéle + bátes', l: LINGUAS_ETIMO.grego, s: { pt: 'nuvem + o que anda', en: 'cloud + one who walks' } }
    ],
    fundo: { pt: 'Nefelibata é quem anda sobre as nuvens. A palavra foi montada com peças gregas para chamar, com carinho ou ironia, os poetas que viviam longe do chão.', en: 'A nefelibata is someone who walks on clouds. The word was assembled from Greek pieces to name, fondly or ironically, poets who lived far from the ground.' },
    familia: ['nebuloso (do latim nebula, prima distante)', 'acrobata (o que anda nas pontas)']
  },
  {
    p: 'alvíssaras', classe: { pt: 'substantivo / interjeição', en: 'noun / interjection' },
    sig: { pt: 'Prêmio dado a quem traz uma boa notícia; também uma exclamação de alegria por ela.', en: 'A reward for whoever brings good news; also an exclamation of joy at it.' },
    raiz: [
      { f: 'alvíçara', l: LINGUAS_ETIMO.ptAntigo, s: { pt: 'recompensa pela boa nova', en: 'reward for good news' } },
      { f: 'al-bushrá', l: LINGUAS_ETIMO.arabe, s: { pt: 'a boa notícia', en: 'the good news' } }
    ],
    fundo: { pt: 'Uma joia dos séculos em que o árabe conviveu com o português na Península Ibérica. Pedir alvíssaras é dizer: "tenho uma notícia tão boa que merece presente".', en: 'A gem from the centuries when Arabic lived alongside Portuguese in the Iberian Peninsula. Asking for alvíssaras means: "my news is so good it deserves a gift".' },
    familia: ['albricias (espanhol)']
  },
  {
    p: 'lúgubre', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Sombrio, fúnebre, que evoca tristeza e morte.', en: 'Gloomy, funereal, evoking sorrow and death.' },
    raiz: [
      { f: 'lugubris', l: LINGUAS_ETIMO.latim, s: { pt: 'de luto, triste', en: 'mournful' } },
      { f: 'lugere', l: LINGUAS_ETIMO.latim, s: { pt: 'chorar um morto, estar de luto', en: 'to mourn' } }
    ],
    fundo: { pt: 'Lúgubre e luto vêm do mesmo choro romano pelos mortos. A palavra pinta o ambiente com a cor do luto.', en: 'Lúgubre and luto (mourning) come from the same Roman weeping for the dead. The word paints a scene in the color of grief.' },
    familia: ['luto', 'enlutado']
  },
  {
    p: 'sinestesia', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Mistura de sentidos: "voz doce", "cor gritante"; também a condição de quem percebe assim.', en: 'A blending of senses: "sweet voice", "loud color"; also the condition of perceiving that way.' },
    raiz: [
      { f: 'synaísthesis', l: LINGUAS_ETIMO.grego, s: { pt: 'sensação conjunta', en: 'joint sensation' } },
      { f: 'sýn + aísthesis', l: LINGUAS_ETIMO.grego, s: { pt: 'junto + sensação, percepção', en: 'together + sensation, perception' } }
    ],
    fundo: { pt: 'Sinestesia é sentir junto: ouvir uma cor, provar uma palavra. Os poetas simbolistas a usavam para escrever o que um sentido só não alcança.', en: 'Synesthesia is sensing together: hearing a color, tasting a word. Symbolist poets used it to write what one sense alone can\'t reach.' },
    familia: ['estética (a ciência do sentir)', 'anestesia (sem sensação)', 'cinestesia']
  },
  {
    p: 'perene', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Que dura muito, que não acaba; contínuo.', en: 'Long-lasting, unending; perennial.' },
    raiz: [
      { f: 'perennis', l: LINGUAS_ETIMO.latim, s: { pt: 'que dura o ano todo, duradouro', en: 'lasting all year, enduring' } },
      { f: 'per + annus', l: LINGUAS_ETIMO.latim, s: { pt: 'através de + ano', en: 'through + year' } }
    ],
    fundo: { pt: 'Perene é o que atravessa os anos. Uma planta perene não morre no inverno; uma amizade perene também não.', en: 'Perennial is what goes through the years. A perennial plant doesn\'t die in winter; neither does a perennial friendship.' },
    familia: ['ano', 'anual', 'aniversário', 'milênio']
  },
  {
    p: 'hedonismo', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Ideia de que o prazer é o bem maior da vida.', en: 'The idea that pleasure is life\'s highest good.' },
    raiz: [
      { f: 'hédoné', l: LINGUAS_ETIMO.grego, s: { pt: 'prazer', en: 'pleasure' } },
      { f: 'hedýs', l: LINGUAS_ETIMO.grego, s: { pt: 'doce, agradável', en: 'sweet, pleasant' } }
    ],
    fundo: { pt: 'Na raiz, o prazer era o que é doce. Os filósofos gregos discutiam se a vida boa era buscar essa doçura — e de que tipo ela deveria ser.', en: 'At the root, pleasure was what is sweet. Greek philosophers debated whether the good life meant seeking that sweetness — and of what kind.' },
    familia: ['hedonista', 'suave (do latim suavis, prima distante)']
  },
  {
    p: 'obsequioso', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Excessivamente prestativo e servil, que bajula para agradar.', en: 'Excessively eager to please; servile.' },
    raiz: [
      { f: 'obsequiosus', l: LINGUAS_ETIMO.latim, s: { pt: 'complacente', en: 'compliant' } },
      { f: 'obsequium', l: LINGUAS_ETIMO.latim, s: { pt: 'condescendência, submissão', en: 'compliance, deference' } },
      { f: 'ob + sequi', l: LINGUAS_ETIMO.latim, s: { pt: 'diante de + seguir', en: 'toward + to follow' } }
    ],
    fundo: { pt: 'O obsequioso segue os outros em tudo. Gentileza vira obséquio; quando passa da medida, vira servilismo.', en: 'The obsequious follows others in everything. Kindness becomes an obséquio (favor); past the measure, it becomes servility.' },
    familia: ['obséquio', 'seguir', 'sequência', 'consequência']
  },
  {
    p: 'acrimônia', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Aspereza no jeito de falar ou tratar; amargura.', en: 'Harshness in speech or manner; bitterness.' },
    raiz: [
      { f: 'acrimonia', l: LINGUAS_ETIMO.latim, s: { pt: 'acidez, aspereza', en: 'sharpness, pungency' } },
      { f: 'acer, acris', l: LINGUAS_ETIMO.latim, s: { pt: 'agudo, cortante, azedo', en: 'sharp, pointed, sour' } }
    ],
    fundo: { pt: 'Acrimônia é ter a fala com gosto azedo e ponta afiada. Da mesma raiz vem o vinagre ("vinho acre") e o próprio acre.', en: 'Acrimony is speech with a sour taste and a sharp edge. The same root gives vinegar ("sour wine") and acre (pungent).' },
    familia: ['acre', 'vinagre', 'acidez', 'agro (azedo)']
  },
  {
    p: 'sicofanta', classe: { pt: 'substantivo', en: 'noun' },
    sig: { pt: 'Delator, caluniador; também o bajulador interesseiro.', en: 'An informer, a slanderer; also a self-serving flatterer.' },
    raiz: [
      { f: 'sycophanta', l: LINGUAS_ETIMO.latim, s: { pt: 'delator', en: 'informer' } },
      { f: 'sykophántes', l: LINGUAS_ETIMO.grego, s: { pt: 'acusador profissional em Atenas', en: 'professional accuser in Athens' } },
      { f: 'sŷkon + phaínein', l: LINGUAS_ETIMO.grego, s: { pt: 'figo + mostrar', en: 'fig + to show' } }
    ],
    fundo: { pt: 'Em Atenas, o sicofanta acusava os outros no tribunal para lucrar. Literalmente é "o que mostra o figo" — mas ninguém sabe ao certo por quê.', en: 'In Athens, the sycophant accused others in court for profit. Literally it\'s "the one who shows the fig" — but nobody knows for sure why.' },
    familia: ['figo (do latim ficus, outra raiz)', 'fenômeno'],
    nota: { pt: 'A explicação do figo é discutida: diz-se que denunciavam quem exportava figos ilegalmente, mas isso pode ser invenção antiga.', en: 'The fig explanation is debated: some say they denounced illegal fig exporters, but that may be an ancient invention.' }
  },
  {
    p: 'estoico', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Que suporta a dor e as dificuldades com serenidade e firmeza.', en: 'Enduring pain and hardship with calm and firmness.' },
    raiz: [
      { f: 'stoicus', l: LINGUAS_ETIMO.latim, s: { pt: 'da escola estoica', en: 'of the Stoic school' } },
      { f: 'stoïkós', l: LINGUAS_ETIMO.grego, s: { pt: 'do pórtico', en: 'of the porch' } },
      { f: 'stoá', l: LINGUAS_ETIMO.grego, s: { pt: 'pórtico, galeria de colunas', en: 'porch, colonnade' } }
    ],
    fundo: { pt: 'Zenão ensinava filosofia num pórtico pintado de Atenas, a Stoa Poikíle. Os alunos viraram "os do pórtico" — e a serenidade diante da dor virou o nome da escola.', en: 'Zeno taught philosophy at a painted porch in Athens, the Stoa Poikile. His students became "those of the porch" — and calm in the face of pain took the school\'s name.' },
    familia: ['estoicismo']
  },
  {
    p: 'bucólico', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Relativo ao campo e à vida simples dos pastores; idílico.', en: 'Relating to the countryside and the simple life of shepherds; idyllic.' },
    raiz: [
      { f: 'bucolicus', l: LINGUAS_ETIMO.latim, s: { pt: 'pastoril', en: 'pastoral' } },
      { f: 'boukolikós', l: LINGUAS_ETIMO.grego, s: { pt: 'dos vaqueiros', en: 'of herdsmen' } },
      { f: 'boukólos', l: LINGUAS_ETIMO.grego, s: { pt: 'vaqueiro, pastor de bois (boûs = boi)', en: 'cowherd (boûs = ox)' } }
    ],
    fundo: { pt: 'A poesia bucólica de Teócrito e Virgílio cantava pastores conversando entre bois e flautas. Bucólico é a saudade de uma vida mais lenta.', en: 'The bucolic poetry of Theocritus and Virgil sang of shepherds talking among oxen and flutes. Bucolic is longing for a slower life.' },
    familia: ['bovino (do latim bos, prima)', 'Bósforo (passagem do boi)']
  },
  {
    p: 'sublime', classe: { pt: 'adjetivo', en: 'adjective' },
    sig: { pt: 'Elevado, de uma beleza ou grandeza que impressiona.', en: 'Lofty; of an overwhelming beauty or grandeur.' },
    raiz: [
      { f: 'sublimis', l: LINGUAS_ETIMO.latim, s: { pt: 'alto, elevado no ar', en: 'high, raised aloft' } }
    ],
    fundo: { pt: 'Sublime é o que está lá no alto. Na química, sublimar é a passagem direta do sólido ao vapor — como se a matéria subisse sem tocar o chão.', en: 'Sublime is what stands up high. In chemistry, sublimation is going straight from solid to vapor — as if matter rose without touching the ground.' },
    familia: ['sublimar', 'sublimação'],
    nota: { pt: 'A origem de "sublimis" é discutida: uma das explicações liga a "sub + limen" (até o umbral de cima), mas não há consenso.', en: 'The origin of "sublimis" is debated: one explanation links it to "sub + limen" (up to the upper threshold), but there\'s no consensus.' }
  }
];
