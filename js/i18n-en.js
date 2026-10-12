/* js/i18n-en.js — Tradução das telas antigas pro inglês
   Script comum (sem módulo). Só faz alguma coisa quando o idioma é inglês.

   COMO FUNCIONA (pra aprender):
   As telas antigas têm o texto escrito direto no HTML e nos templates do JS.
   Em vez de mexer em centenas de lugares, este arquivo tem um DICIONÁRIO
   "texto em português" → "texto em inglês" e um tradutor que:
     1. quando o app abre, percorre a página e troca cada texto que achar no dicionário;
     2. fica de olho (MutationObserver) em tudo que aparece depois na tela
        (toasts, listas, popups) e traduz na hora em que aparece.
   Também troca placeholder, title e aria-label (textos que aparecem em
   campos e em leitores de tela).
   Textos que começam com um pedaço conhecido (ex: "❌ erro: <detalhe>") têm só
   o pedaço conhecido traduzido.
   Texto que não está no dicionário continua em português — pra traduzir mais
   alguma coisa, é só acrescentar uma linha aqui. Telas NOVAS usam t() (js/i18n.js). */

const EN_UI = {
  // navegação e geral
  'Início': 'Home', 'Home': 'Home', 'Explorar': 'Explore', 'Livros': 'Books', 'Mensagens': 'Messages', 'Ajustes': 'Settings',
  'Perfil': 'Profile', 'Configurações': 'Settings', 'Buscar': 'Search', 'Voltar': 'Back', '← voltar': '← back', '← anterior': '← previous', 'próxima →': 'next →',
  'Continuar': 'Continue', 'Entendi': 'Got it', 'Pronto': 'Done', 'Prontinho ✨': 'All set ✨', 'Salvar': 'Save', 'salvar': 'save', 'cancelar': 'cancel',
  'confirmar': 'confirm', 'Confirmar?': 'Confirm?', 'agora não': 'not now', 'Agora não': 'Not now', 'Ativar': 'Turn on', 'Enviar': 'Send', 'Postar': 'Post',
  'postar': 'post', 'Publicar': 'Publish', 'Guardar': 'Keep', 'Editar': 'Edit', 'Compartilhar': 'Share', 'compartilhar': 'share', 'baixar': 'download',
  'limpar': 'clear', 'hoje': 'today', 'Tudo': 'All', 'tudo': 'all', 'Carregando...': 'Loading...', 'Buscando...': 'Searching...', 'Salvando...': 'Saving...',
  'Abrindo...': 'Opening...', 'Guardando...': 'Keeping...', 'Guardado ✓': 'Kept ✓', 'enviando...': 'sending...', 'configurando...': 'setting up...',
  'gerando link...': 'creating link...', 'Nada encontrado.': 'Nothing found.', 'Não consegui carregar.': 'Couldn\'t load.', 'Não deu pra carregar agora.': 'Couldn\'t load right now.',
  'Nada por aqui ainda.': 'Nothing here yet.', 'Ninguém encontrado.': 'No one found.', 'Erro na busca.': 'Search error.', 'Não consegui buscar agora.': 'Couldn\'t search right now.',
  'Olá,': 'Hi,', 'Seguir': 'Follow', 'Seguindo': 'Following', 'seguindo': 'following', 'Seguidores': 'Followers', 'seguidores': 'followers', 'visualizações': 'views',
  'Deixou de seguir': 'Unfollowed', 'Favoritar': 'Favorite', 'Desfavoritar': 'Unfavorite', 'Bloquear': 'Block', 'Desbloquear': 'Unblock', 'Desbloqueado': 'Unblocked',
  'Denunciar': 'Report', 'Enviar DM': 'Send DM', 'Pessoas bloqueadas': 'Blocked people', 'Ninguém bloqueado.': 'No one blocked.',
  'Sair da conta': 'Log out', 'Notificações': 'Notifications', 'Modo escuro': 'Dark mode', 'Tema': 'Theme', 'Tema Clima': 'Weather theme', 'Vibração': 'Vibration',
  'Sons suaves': 'Soft sounds', 'Suporte e feedback': 'Support & feedback', 'Termos de Uso e Política de Privacidade': 'Terms of Use & Privacy Policy',
  'Horário em 12h (AM/PM)': '12-hour time (AM/PM)', 'Reordenar tipos': 'Reorder types', 'Reordenar tipos de post': 'Reorder post types',
  'Notificações de amigos': 'Friends\' notifications', 'Átomo · versão 0.1 (Beta)': 'Átomo · version 0.1 (Beta)', 'seu diário tem visitas.': 'your diary has visitors.',
  'troca a paleta clara pela escura': 'switches the light palette for the dark one',
  'avisa quando um amigo posta ou comenta': 'lets you know when a friend posts or comments',
  'mostra os horários tipo 09:00pm em vez de 21:00': 'shows times like 09:00pm instead of 21:00',
  'mostra a aba de conhecer gente com gosto parecido': 'shows the tab to meet people with similar taste',
  'pequenos sons ao atualizar, receber notificação e ganhar selo. No celular em silencioso, desligue aqui': 'little sounds when refreshing, getting notifications and earning badges. If your phone is on silent, turn them off here',
  'vibra de leve ao tocar nas emoções, receber avisos e ganhar selos': 'gentle vibration when tapping emotions, getting alerts and earning badges',
  'o fundo do app muda com o clima real e a hora do dia — sol, nuvens, chuva, noite com vaga-lumes e primavera': 'the app background follows the real weather and time of day — sun, clouds, rain, firefly nights and spring',
  'manda uma sugestão ou reclamação — chega direto pra gente.': 'send a suggestion or complaint — it comes straight to us.',
  'vai com seu @ e seu e-mail de cadastro, pra eu poder te responder': 'it goes with your @ and email so I can reply to you',
  'escreve aqui o que você quer me contar...': 'write here what you want to tell me...', '💡 Sugestão': '💡 Suggestion', '⚠️ Reclamação': '⚠️ Complaint',
  // login e cadastro
  'Bem-vindo(a) ao Átomo': 'Welcome to Átomo', 'Entrar': 'Log in', 'Criar conta': 'Sign up', 'Continuar com Google': 'Continue with Google',
  'criar conta com e-mail': 'sign up with email', 'já tem conta? entrar': 'already have an account? log in', 'esqueci minha senha': 'I forgot my password',
  'seu e-mail': 'your email', 'sua senha': 'your password', 'crie uma senha': 'create a password', 'confirme a senha': 'confirm password', 'Nome': 'Name', 'Bio': 'Bio',
  'Seu gênero': 'Your gender', '(usado só pro Match)': '(only used for Match)', 'Quer ver no Match:': 'Show me in Match:', 'Só mais duas coisinhas': 'Just two more things',
  'Última coisinha': 'One last thing', 'a que horas você costuma acordar?': 'what time do you usually wake up?', 'e a que horas costuma dormir?': 'and what time do you usually go to sleep?',
  'qual desses te interessa mais? isso ajuda a gente a te mostrar coisa boa': 'which of these interest you most? it helps us show you good stuff',
  'Você tem um convite pra um grupo no Átomo 💛 — crie sua conta e a gente te leva até ele.': 'You have an invite to a group on Átomo 💛 — create your account and we\'ll take you there.',
  '✨ Entrando...': '✨ Logging in...', '✨ Bem-vinda de volta,': '✨ Welcome back,', '✨ Conta criada! Confirma seu e-mail pra poder entrar.': '✨ Account created! Confirm your email to log in.',
  '✨ Te mandamos um e-mail pra redefinir a senha': '✨ We sent you an email to reset your password', '❌ as senhas não são iguais': '❌ the passwords don\'t match',
  '❌ confirma seu e-mail antes de entrar': '❌ confirm your email before logging in', '❌ digita seu e-mail no campo acima primeiro': '❌ type your email in the field above first',
  '❌ e-mail ou senha errados': '❌ wrong email or password', '❌ preenche e-mail e senha': '❌ fill in email and password',
  '❌ preenche e-mail e uma senha com 6+ caracteres': '❌ fill in your email and a password with 6+ characters', '❌ preenche nome e @usuário': '❌ fill in name and @username',
  '❌ sessão expirada, sai e entra de novo': '❌ session expired, log out and in again', '✨ Perfil atualizado': '✨ Profile updated', 'Editar perfil': 'Edit profile',
  'Adicionar foto': 'Add photo', 'GIFs animados também funcionam (até 3 MB)': 'Animated GIFs work too (up to 3 MB)',
  // instalação e notificações
  'Adicione o Átomo à tela inicial': 'Add Átomo to your home screen', 'Instalar agora': 'Install now', 'Seu navegador já pode instalar o Átomo com um toque.': 'Your browser can install Átomo with one tap.',
  'Assim ele abre rapidinho, como um app de verdade — e é onde os lembretes de escrever vão te encontrar.': 'That way it opens fast, like a real app — and it\'s where your writing reminders will find you.',
  'Ativar notificações?': 'Turn on notifications?', 'Um lembrete de manhã e à noite pra você não perder o hábito de escrever.': 'A reminder in the morning and at night so you keep the writing habit.',
  'Nenhuma notificação ainda 🌱': 'No notifications yet 🌱', '🔔 Nova notificação chegou!': '🔔 New notification!', '💬 Nova mensagem!': '💬 New message!',
  'Ative as notificações primeiro (toque no sino) 🔔': 'Turn on notifications first (tap the bell) 🔔', 'Seu navegador não suporta notificações push 😕': 'Your browser doesn\'t support push notifications 😕',
  'Enviando notificação de teste…': 'Sending test notification…', 'Enviada! Deve chegar em alguns segundos 🔔': 'Sent! It should arrive in a few seconds 🔔',
  'Erro ao testar notificação 😕': 'Error testing notification 😕', 'Nenhuma inscrição push encontrada nesse aparelho 😕': 'No push subscription found on this device 😕',
  '💭 Toda manhã o @Átomo deixa uma pergunta no Feed pra você responder': '💭 Every morning @Átomo leaves a question in the Feed for you to answer',
  // feed e posts
  'Pra você': 'For you', 'Recentes': 'Recent', 'Mais relevantes': 'Most relevant', 'Escreva algo...': 'Write something...', 'O que você quer compartilhar hoje?': 'What do you want to share today?',
  'Comentários': 'Comments', 'Escreva um comentário...': 'Write a comment...', 'Seja a primeira pessoa a comentar 💬': 'Be the first to comment 💬', 'ver respostas': 'see replies',
  'Repostar no meu feed': 'Repost to my feed', 'Enviar pra um amigo': 'Send to a friend', 'Compartilhar fora do app': 'Share outside the app',
  'cola o link em qualquer rede — Instagram, Twitter, onde quiser.': 'paste the link anywhere — Instagram, Twitter, wherever you like.',
  '🔗 Copiar link': '🔗 Copy link', '📤 Post enviado!': '📤 Post sent!', '🔁 Repostado no seu feed': '🔁 Reposted to your feed',
  '🗑️ Post apagado': '🗑️ Post deleted', '📌 Post fixado no topo do Diário': '📌 Post pinned to the top of the Diary', '📍 Post desafixado': '📍 Post unpinned',
  '✨ postado no feed!': '✨ posted to the feed!', '✨ Compartilhado no explorar': '✨ Shared to Explore', '↗ Compartilhado no seu feed': '↗ Shared to your feed',
  '✨ do seu interesse': '✨ matches your interests', '🔗 Link copiado! Cole onde quiser compartilhar': '🔗 Link copied! Paste it wherever you want',
  '✨ link copiado! cola onde quiser': '✨ link copied! paste it anywhere', '😕 não consegui copiar o link — tenta de novo': '😕 couldn\'t copy the link — try again',
  'Esse post não está carregado no feed agora': 'That post isn\'t loaded in the feed right now', '📎 anexar referência': '📎 attach a reference',
  'Spam': 'Spam', 'Assédio': 'Harassment', 'Conteúdo ofensivo': 'Offensive content', 'Outro motivo': 'Other reason',
  '🚩 Denúncia enviada. Obrigada por ajudar a manter o Átomo seguro': '🚩 Report sent. Thanks for helping keep Átomo safe', '🚫 Bloqueado': '🚫 Blocked',
  '💛 Agora você segue essa pessoa': '💛 You\'re now following this person', 'Sugestões pra seguir': 'Suggestions to follow', 'descobrir mais': 'discover more',
  'buscar posts, tipos...': 'search posts, types...', 'Buscar por @usuário ou nome...': 'Search by @username or name...', 'Buscar por tag...': 'Search by tag...',
  'Livro': 'Book', 'Autor': 'Author', 'Título': 'Title', 'Autor / artista / diretor': 'Author / artist / director', 'Trecho, citação ou o que te marcou (opcional)': 'Excerpt, quote or what stayed with you (optional)',
  'Digite o nome do livro...': 'Type the book title...', 'Digite o nome do filme...': 'Type the movie title...', 'Digite o nome da música...': 'Type the song name...', 'Digite o nome do podcast...': 'Type the podcast name...',
  'Nenhum filme encontrado.': 'No movies found.', 'Nenhum livro encontrado.': 'No books found.', 'Nenhum podcast encontrado.': 'No podcasts found.', 'Nenhuma música encontrada.': 'No songs found.',
  '😕 esse filme não tem prévia disponível': '😕 this movie has no preview available', '😕 sem prévia disponível': '😕 no preview available',
  // perfil, diário, selos
  'Meu Diário': 'My Diary', 'um espacinho pra você': 'a little space for you', 'Diário rápido': 'Quick diary', 'O que te fez sorrir hoje?': 'What made you smile today?',
  'Pode ser pequeno. Um instante, uma lembrança, alguém.': 'It can be small. A moment, a memory, someone.', 'Escreve aqui...': 'Write here...',
  'Uma coisa que você é grato(a) hoje': 'Something you\'re grateful for today', 'Uma coisa que você é grato(a) hoje.': 'Something you\'re grateful for today.',
  'escreve sua gratidão aqui...': 'write your gratitude here...', 'Escolhe 1, 2 ou 3 fotos do momento (ou nenhuma) e escreve embaixo.': 'Pick 1, 2 or 3 photos of the moment (or none) and write underneath.', 'Tira uma fotinha do momento e grave com uma frase embaixo.': 'Pick 1, 2 or 3 photos of the moment and write a line underneath.',
  'Tira uma fotinha do momento e grave com uma frase embaixo.': 'Snap a little photo of the moment and keep it with a line underneath.', 'toque pra tirar uma foto': 'tap to take a photo',
  'obrigada por dividir isso com você mesma.': 'thanks for sharing this with yourself.', 'obrigada por reparar nisso hoje.': 'thanks for noticing this today.',
  '☀️ guardado no seu diário': '☀️ kept in your diary', '📸 guardado no seu diário': '📸 kept in your diary', '🔒 Guardado só pra você': '🔒 Kept just for you',
  '❌ escreve algo antes de guardar': '❌ write something before keeping it', '❌ escreve sua gratidão antes de guardar': '❌ write your gratitude before keeping it',
  '❌ não encontrei essa anotação': '❌ couldn\'t find that entry', '❌ não encontrei esse post': '❌ couldn\'t find that post',
  'Caixinha de Pandora': 'Pandora\'s little box', 'Nada guardado aqui ainda.': 'Nothing kept here yet.',
  'Tudo que você guardou sobre o que te deixou triste, ansiosa ou brava — só você vê isso aqui. Releia quando quiser, ou apague quando não quiser mais carregar.': 'Everything you kept about what made you sad, anxious or angry — only you can see this. Reread it whenever you want, or delete it when you don\'t want to carry it anymore.',
  'Um cartão bonito da sua anotação, pra mandar por fora — abre certinho como foto se for pro story.': 'A pretty card of your entry to send elsewhere — it opens as a photo if you post it to your story.',
  '💾 imagem salva — agora é só anexar onde quiser compartilhar': '💾 image saved — now just attach it wherever you want to share',
  'Sua sequência': 'Your streak', 'dias seguidos': 'days in a row', 'dias escrevendo': 'days writing', 'toque pra colorir sua sequência': 'tap to color your streak',
  'Sua sequência conta os dias seguidos em que você escreveu algo — hoje ou ontem, sem pular. Escreva todo dia pra manter ela viva.': 'Your streak counts the days in a row you wrote something — today or yesterday, no skipping. Write every day to keep it alive.',
  'Sua sequência de escrita tá firme. Continue assim 🧶': 'Your writing streak is going strong. Keep it up 🧶', 'Emoji da sequência': 'Streak emoji',
  '🛟 Ontem ficou em branco, mas sua ofensiva foi salva por uma chance. Escreve hoje pra continuar!': '🛟 Yesterday was blank, but your streak was saved by a second chance. Write today to keep going!',
  'Coleção de selos': 'Badge collection', 'Ver coleção de selos': 'See badge collection', 'Novo selo!': 'New badge!', '7 dias seguidos!': '7 days in a row!',
  'Uma semana inteira escrevendo. Guardado na sua coleção 📮': 'A whole week of writing. Kept in your collection 📮',
  'Perguntas anônimas': 'Anonymous questions', 'perguntas anônimas': 'anonymous questions', 'Pergunta anônima': 'Anonymous question', 'pergunta anônima': 'anonymous question',
  'Escreva sua pergunta...': 'Write your question...', 'Ela chega sem o seu nome — só a pessoa vê a pergunta, e pode responder em público': 'It arrives without your name — only that person sees the question, and they can answer publicly',
  'Nenhuma pergunta por enquanto.': 'No questions for now.', '❓ Pergunta enviada, sem o seu nome': '❓ Question sent, without your name', '❓ Perguntas anônimas respondidas': '❓ Answered anonymous questions',
  'Escreva sua resposta (vai aparecer pública no seu perfil e no feed)...': 'Write your answer (it will be public on your profile and in the feed)...',
  'Escreve uma resposta antes de enviar': 'Write an answer before sending', '✅ Resposta publicada no seu perfil e no feed': '✅ Answer published on your profile and in the feed',
  'Quem visitou': 'Who visited', 'Ninguém visitou seu perfil ainda.': 'No one has visited your profile yet.',
  'Toda visita conta — não tem como visitar sem aparecer. Se não quer que alguém saiba que você viu o perfil, não visite.': 'Every visit counts — there\'s no way to visit without showing up. If you don\'t want someone to know you saw their profile, don\'t visit.',
  'Quem te respondeu': 'Who replied to you', 'Ninguém respondeu ainda.': 'No one has replied yet.', '💛 o que você precisa agora': '💛 what you need right now', '💛 o que você precisa agora?': '💛 what do you need right now?',
  'ex: um conselho, uma música, um abraço...': 'e.g. some advice, a song, a hug...', '💛 pedido publicado no seu perfil': '💛 request posted on your profile', '💛 pediu apoio': '💛 asked for support',
  'escreve o que você precisa antes de pedir': 'write what you need before asking', 'escreve um conselho...': 'write some advice...', 'escreve o conselho antes de enviar': 'write the advice before sending',
  'não preciso mais': 'I don\'t need it anymore', 'pedir': 'ask', '💜 guardado no seu perfil': '💜 kept on your profile',
  // humor e "seu dia"
  'como você está se sentindo agora?': 'how are you feeling right now?', 'feliz': 'happy', 'calma': 'calm', 'triste': 'sad', 'ansiosa': 'anxious', 'brava': 'angry',
  'O que te deixou assim?': 'What made you feel this way?', 'o motivo, se quiser contar...': 'the reason, if you want to share...', 'Seu dia': 'Your day', 'Humor': 'Mood',
  'Checklist': 'Checklist', 'ex: não esquecer de tomar remédio': 'e.g. don\'t forget to take my medicine', 'nada pendente — adiciona algo pra não esquecer': 'nothing pending — add something so you don\'t forget',
  'Avisar em que horário?': 'Remind me at what time?', 'o app avisa nesse horário até você marcar como feito.': 'the app reminds you at this time until you mark it as done.',
  'Pausa, respira, e guarda um espaço pras coisas que importam.': 'Pause, breathe, and save some room for what matters.', 'Como foi seu sonho?': 'How was your dream?',
  'Registra antes que esqueça 💭': 'Write it down before you forget 💭',
  // match
  'Match': 'Match', 'Match por interesse': 'Interest match', 'Dar match?': 'Match?', 'Sim, dar match': 'Yes, match', 'vocês têm interesses em comum.': 'you have interests in common.',
  'Gente com gosto parecido com o seu. Se as duas curtirem, vira conversa 💬': 'People with taste like yours. If you both like each other, it becomes a chat 💬',
  'Procurando gente com interesse parecido...': 'Looking for people with similar interests...', 'Ninguém com interesse em comum ainda. Volte mais tarde 🌱': 'No one with shared interests yet. Come back later 🌱',
  '💛 Deu match! Abrindo conversa...': '💛 It\'s a match! Opening chat...', '💛 Match ativado! já dá pra ver quem tem interesse parecido': '💛 Match is on! you can now see people with similar interests',
  'oi, sou eu, o Átomo 🤍': 'hi, it\'s me, Átomo 🤍', 'quero conhecer 💛': 'I want to meet people 💛', 'não quero': 'no thanks',
  'reparei que você já tem uns dias de diário por aqui — que tal conhecer gente com o mesmo gosto? o Match mostra pessoas com os mesmos assuntos favoritos que você escolheu, pra trocar ideia sobre livro, filme, poema, o que for. sem pressão, dá pra desligar quando quiser.': 'I noticed you\'ve been writing here for a few days — how about meeting people with the same taste? Match shows people who picked the same favorite topics as you, to chat about books, movies, poems, anything. No pressure, you can turn it off anytime.',
  // mensagens
  'Nova conversa': 'New chat', 'Comece a conversa': 'Start the conversation', 'Perfil da conversa': 'Chat profile', 'buscar um amigo...': 'search for a friend...',
  'Nenhuma conversa ainda — toca no + aqui em cima pra começar uma 💬': 'No chats yet — tap the + up here to start one 💬',
  'Manda um oi, um GIF ou um sticker — a conversa começa aqui 💬': 'Say hi, send a GIF or a sticker — the conversation starts here 💬',
  'Você ainda não segue ninguém — segue alguém primeiro pra poder mandar posts 💬': 'You don\'t follow anyone yet — follow someone first so you can send posts 💬',
  'Buscar figurinha (ex: anime, fofo, gato)...': 'Search stickers (e.g. anime, cute, cat)...', 'Nenhuma figurinha encontrada.': 'No stickers found.', 'Não consegui carregar figurinhas agora.': 'Couldn\'t load stickers right now.',
  '❌ Não é possível enviar mensagem — bloqueio ativo entre vocês': '❌ You can\'t send messages — one of you has blocked the other', '❌ erro ao abrir conversa': '❌ error opening chat',
  'escreve uma mensagem antes de mandar 📝': 'write a message before sending 📝', '🙈 conversa escondida': '🙈 chat hidden', '🎨 tema da conversa atualizado': '🎨 chat theme updated',
  '❌ esse navegador não permite gravar áudio': '❌ this browser can\'t record audio', '❌ não consegui acessar o microfone': '❌ couldn\'t access the microphone', '🎙️ enviando áudio...': '🎙️ sending audio...',
  // livros, estante, leitor
  'clube do livro': 'book club', 'Clube do Livro': 'Book Club', 'livros gratuitos': 'free books', 'minha estante': 'my shelf', 'estante autoral': 'indie shelf', 'comunidades': 'communities', 'Comunidades': 'Communities',
  'Buscar um livro (título ou autor)...': 'Search for a book (title or author)...', 'Buscar por título ou autor...': 'Search by title or author...',
  'Nenhum livro encontrado ainda — tenta buscar por outro termo.': 'No books found yet — try another search.', 'Prévia': 'Preview', 'Prévia não disponível pra este livro.': 'No preview available for this book.',
  'Carregando o livro...': 'Loading the book...', 'Carregando o texto...': 'Loading the text...', 'Não consegui abrir esse epub agora.': 'Couldn\'t open this epub right now.',
  'Não consegui carregar esse livro agora — tenta de novo em instantes.': 'Couldn\'t load this book right now — try again in a moment.',
  'Não consegui carregar esse texto agora — tenta de novo em instantes.': 'Couldn\'t load this text right now — try again in a moment.',
  'clássico de domínio público — dá pra ler o livro inteiro, direto por aqui': 'public-domain classic — you can read the whole book right here',
  'domínio público (Wikisource) — dá pra ler o texto inteiro, direto por aqui': 'public domain (Wikisource) — you can read the whole text right here',
  'esse aqui dá pra ler completo, direto por aqui': 'you can read this one in full, right here', 'apenas amostra': 'sample only', '📜 domínio público': '📜 public domain', 'Gratuito': 'Free',
  '👀 o Google só libera uma amostra desse livro pra ler — pra ler ele inteiro é preciso comprar ou pegar emprestado no site deles.': '👀 Google only offers a sample of this book — to read the whole thing you need to buy or borrow it on their site.',
  'sua estante tá vazia': 'your shelf is empty', 'ainda não tem livro nenhum aqui': 'there are no books here yet', 'Entra na sua conta pra ver sua estante.': 'Log in to see your shelf.',
  'envia um epub pra começar a ler por aqui, sincronizado em qualquer aparelho': 'upload an epub to start reading here, synced on any device', 'escolher arquivo epub': 'choose epub file',
  'escolhe o arquivo epub': 'choose the epub file', 'enviando epub...': 'uploading epub...', 'baixar epub': 'download epub', '📘 livro enviado pra sua estante': '📘 book added to your shelf',
  'removido da estante': 'removed from shelf', '📗 leitura completa': '📗 finished reading', 'Você terminou o livro!': 'You finished the book!', 'o que você achou até aqui?': 'what did you think so far?',
  'Lendo': 'Reading', 'pág.': 'p.', 'página': 'page', 'Criar citação': 'Create quote', 'criar citação': 'create quote', 'Compartilhar citação': 'Share quote',
  'Trecho do livro': 'Book excerpt', 'cole ou escreva o trecho que você quer guardar...': 'paste or write the excerpt you want to keep...', '🖍️ grifar esse trecho': '🖍️ highlight this excerpt',
  '🖍️ grifado — agora é só compartilhar a citação': '🖍️ highlighted — now just share the quote', '❌ cola ou escreve um trecho primeiro': '❌ paste or write an excerpt first',
  'no grupo': 'in the group', 'no feed': 'in the feed', 'fora do app': 'outside the app', '✨ citação compartilhada no grupo!': '✨ quote shared in the group!',
  'Que horas você quer ler?': 'What time do you want to read?', 'configurar lembrete': 'set reminder', 'todo dia nesse horário, um lembrete gentil pra você continuar lendo.': 'every day at this time, a gentle reminder to keep reading.',
  'ler fortalece sua sequência e seu hábito. que tal configurar um lembrete pra continuar lendo outros dias?': 'reading strengthens your streak and your habit. how about a reminder to keep reading on other days?',
  '📚 lembrete de leitura configurado!': '📚 reading reminder set!', '❌ erro ao baixar o livro': '❌ error downloading the book',
  // clubes e comunidades
  'Criar clube': 'Create club', 'Criar clube do livro': 'Create book club', 'Criar novo clube': 'Create new club', 'Nome do clube': 'Club name', 'ex: Clube das Quintas': 'e.g. Thursday Club',
  'sobre o que é esse clube...': 'what is this club about...', 'clube privado (só quem você convidar)': 'private club (only people you invite)', 'Convidar pro clube': 'Invite to the club', 'convidar pro clube': 'invite to the club',
  'sair do clube': 'leave the club', 'você saiu do clube': 'you left the club', 'entrar no clube': 'join the club', '🎉 você entrou no clube': '🎉 you joined the club', '✨ Clube criado!': '✨ Club created!',
  'nenhum clube ainda': 'no clubs yet', 'crie o primeiro e chame gente pra discutir livro junto': 'create the first one and invite people to discuss books together',
  'Definir livro atual': 'Set current book', 'mudar livro atual': 'change current book', 'nenhum livro definido ainda': 'no book set yet', '📖 livro do clube atualizado': '📖 club book updated',
  '❌ esse clube ainda não tem um livro definido': '❌ this club doesn\'t have a book yet', '📖 capítulo atualizado': '📖 chapter updated', 'capítulo (ex: cap. 5)': 'chapter (e.g. ch. 5)',
  'avançar pra esse capítulo': 'move to this chapter', 'Membros': 'Members', 'ver membros': 'see members', 'ver os membros': 'see the members', 'sem membros ainda': 'no members yet',
  'Sugerir livro pra roleta': 'Suggest a book for the wheel', '🎲 sugestão adicionada pra roleta': '🎲 suggestion added to the wheel', '❌ precisa de pelo menos 1 sugestão pra girar': '❌ you need at least 1 suggestion to spin',
  'Criar comunidade': 'Create community', 'Criar comunidade de estudo': 'Create study community', '+ criar comunidade': '+ create community', 'Nome da comunidade': 'Community name',
  'ex: Vestibular 2027': 'e.g. Finals 2027', 'sobre o que é essa comunidade...': 'what is this community about...', 'comunidade privada (só quem você convidar)': 'private community (only people you invite)',
  'Categoria': 'Category', 'Comunidade': 'Community', 'Clube': 'Club', 'Convidar pra comunidade': 'Invite to the community', 'convidar pra comunidade': 'invite to the community',
  'entrar na comunidade': 'join the community', 'sair da comunidade': 'leave the community', '🎉 você entrou na comunidade': '🎉 you joined the community', '👋 você saiu da comunidade': '👋 you left the community',
  '✨ Comunidade criada!': '✨ Community created!', 'nenhuma comunidade ainda': 'no communities yet', 'crie a primeira — vestibular, concurso, idioma, filosofia...': 'create the first one — exams, languages, philosophy...',
  'O que você quer compartilhar com a comunidade?': 'What do you want to share with the community?', 'o que você quer compartilhar com a comunidade?': 'what do you want to share with the community?',
  'mural vazio ainda': 'the board is still empty', 'seja a primeira pessoa a postar algo por aqui': 'be the first to post something here', 'Não consegui carregar o mural.': 'Couldn\'t load the board.',
  'na mesa agora': 'on the table now', 'tema de hoje': 'today\'s topic', 'salvar tema': 'save topic', '📌 tema atualizado': '📌 topic updated', 'Prazo (opcional)': 'Deadline (optional)',
  'editar prazo': 'edit deadline', 'Editar prazo': 'Edit deadline', 'salvar prazo': 'save deadline', '⏱ prazo atualizado': '⏱ deadline updated', 'escolher data': 'pick a date', 'escolher data (opcional)': 'pick a date (optional)',
  'Ranking de leitura': 'Reading ranking', 'quem mais leu por aqui': 'who read the most here', 'Não consegui carregar o ranking.': 'Couldn\'t load the ranking.', 'Não consegui carregar os membros.': 'Couldn\'t load the members.',
  'tornar admin': 'make admin', 'tirar admin': 'remove admin', '⭐ agora é admin': '⭐ is now admin', 'admin removido': 'admin removed', 'remover da comunidade': 'remove from community', '👋 removido da comunidade': '👋 removed from community',
  '❌ dá um nome pra comunidade': '❌ give the community a name', '❌ dá um nome pro clube': '❌ give the club a name', '❌ não consegui abrir essa comunidade': '❌ couldn\'t open this community', '❌ não consegui abrir o clube': '❌ couldn\'t open the club',
  '❌ não consegui montar o convite': '❌ couldn\'t create the invite', '🔒 clubes privados ainda não têm link de convite — chama a pessoa por DM': '🔒 private clubs don\'t have invite links yet — message the person directly',
  '🔒 comunidades privadas ainda não têm link de convite — chama a pessoa por DM': '🔒 private communities don\'t have invite links yet — message the person directly',
  'iniciar sala de call de estudo': 'start a study call room', 'gente estudando junto': 'people studying together', 'seu status:': 'your status:', 'relendo o capítulo': 'rereading the chapter',
  '🎙 discussão': '🎙 discussion', '🤫 leitura silenciosa': '🤫 silent reading', '⏱ só pomodoro': '⏱ pomodoro only', 'foco': 'focus', 'foco + conversa': 'focus + talk', 'silêncio': 'silence', 'pomodoro': 'pomodoro',
  'ex: revisão de exatas': 'e.g. math review', '🎓 vestibular': '🎓 entrance exams', '📝 concurso': '📝 civil service exams', '🗣 idioma': '🗣 languages', '💭 filosofia': '💭 philosophy', '📚 geral': '📚 general', 'geral': 'general',
  '🎙 a sala de áudio caiu — o resto continua funcionando': '🎙 the audio room dropped — everything else still works', '🎙 não consegui carregar o áudio agora': '🎙 couldn\'t load the audio right now',
  '🎙 não consegui ligar o áudio (talvez falte permissão de microfone) — a sala continua aberta': '🎙 couldn\'t turn on audio (maybe the microphone permission is missing) — the room is still open',
  // estante autoral
  'Publicar livro': 'Publish book', 'tem um livro seu? publique aqui': 'have a book of your own? publish it here', 'Título do livro': 'Book title', 'título do livro': 'book title',
  'descrição (opcional)': 'description (optional)', 'Descrição (opcional)': 'Description (optional)', 'preço (ex: 19,90)': 'price (e.g. 19.90)', 'escolher capa (opcional)': 'choose cover (optional)', 'adicionar capa (opcional)': 'add cover (optional)',
  'enviar pra revisão': 'submit for review', 'seu livro entra numa fila de revisão antes de aparecer pra outras pessoas. se for recusado, você recebe o motivo e pode corrigir e reenviar.': 'your book goes into a review queue before other people can see it. if it\'s rejected, you\'ll get the reason and can fix and resubmit.',
  '📚 livro enviado! entra na fila de revisão': '📚 book submitted! it\'s now in the review queue', '📬 reenviado pra revisão': '📬 resubmitted for review', 'corrigir e reenviar': 'fix and resubmit', '+ enviar outro livro': '+ submit another book',
  'nenhum livro enviado ainda': 'no books submitted yet', 'seja a primeira pessoa a publicar um livro': 'be the first to publish a book', 'nenhuma compra ainda': 'no purchases yet', 'Entra na sua conta pra ver a estante autoral.': 'Log in to see the indie shelf.',
  'Recusar livro': 'Reject book', 'recusar': 'reject', 'aprovar': 'approve', 'motivo (a pessoa vai receber isso pra poder corrigir)': 'reason (the author will receive this so they can fix it)', 'escreve um motivo pra ela poder corrigir': 'write a reason so they can fix it',
  'fila vazia': 'queue is empty', 'nenhum livro esperando revisão agora': 'no books waiting for review right now', 'deixar uma avaliação': 'leave a review', 'enviar avaliação': 'send review', 'escolhe uma nota de 1 a 5': 'pick a rating from 1 to 5',
  'um comentário (opcional)': 'a comment (optional)', '⭐ avaliação enviada': '⭐ review sent', 'abrindo pagamento...': 'opening payment...', '❌ erro ao processar a compra': '❌ error processing the purchase',
  'escreve um título': 'write a title', 'escreve um preço válido': 'write a valid price', 'toque pra baixar': 'tap to download',
  // rádio e outros
  'rádio Átomo': 'Átomo radio', 'estações ao vivo': 'live stations', 'ao vivo': 'live', 'tocando agora:': 'now playing:', 'Estilo do rádio': 'Radio style', 'escolher estilo': 'choose style',
  'ex: indie, mpb, lo-fi...': 'e.g. indie, mpb, lo-fi...', 'ou um estilo (busca no Deezer)': 'or a style (Deezer search)', 'voltar pro top do momento': 'back to the current top hits', 'variado': 'mixed',
  '📻 rádio voltou a tocar o top do momento': '📻 radio is back to the current top hits', '😕 não consegui ligar o rádio agora': '😕 couldn\'t turn on the radio right now',
  'preciso da sua localização pra mostrar o clima — ative a permissão e tenta ligar de novo': 'I need your location to show the weather — allow it and try turning it on again',
  'Toque em qualquer lugar pra fechar': 'Tap anywhere to close', '💌 recebido, obrigada!': '💌 received, thank you!', '⭐ adicionado aos favoritos': '⭐ added to favorites', '☆ removido dos favoritos': '☆ removed from favorites',
  'Escolhe até 5 — tira um pra trocar 🙂': 'Pick up to 5 — remove one to swap 🙂', '❌ precisa deixar pelo menos um tipo visível': '❌ at least one type must stay visible',
  'Use as setas pra reordenar. Toque no ✕ pra esconder um tipo do composer.': 'Use the arrows to reorder. Tap ✕ to hide a type from the composer.',
  'Escrever': 'Write', 'Foto': 'Photo', 'Tirar foto': 'Take photo', 'Escolher da galeria': 'Choose from gallery', 'Compartilhável': 'Shareable', 'fica guardado só no seu perfil.': 'it stays only on your profile.',
  'Palavra do dia': 'Word of the day', 'Idioma': 'Language', 'Idioma do livro': 'Book language', 'Português': 'Portuguese', 'Inglês': 'English',
  // prefixos (quando vem um detalhe depois, só o começo é traduzido)
  '❌ erro:': '❌ error:', '❌ erro ao enviar:': '❌ error sending:', '❌ erro ao enviar': '❌ error sending', '❌ erro ao postar:': '❌ error posting:', '❌ erro ao curtir:': '❌ error liking:',
  '❌ erro no upload:': '❌ upload error:', '❌ erro no upload': '❌ upload error', '❌ erro no login:': '❌ login error:', '❌ erro no envio:': '❌ sending error:', '❌ erro ao repostar:': '❌ error reposting:',
  '❌ erro ao importar:': '❌ import error:', '❌ erro ao definir o livro:': '❌ error setting the book:', '❌ erro no upload do epub:': '❌ epub upload error:', 'Erro ao testar:': 'Test error:',
  '📻 sintonizado na': '📻 tuned to', '📻 rádio ajustado pra': '📻 radio set to', '📖 o clube vai ler:': '📖 the club will read:'
};

// textos com número no meio: regex → função que monta o inglês
const EN_REGRAS = [
  [/^há (\d+) min$/, (m) => `${m[1]} min ago`],
  [/^há (\d+) h$/, (m) => `${m[1]} h ago`],
  [/^há (\d+) dia\(s\)$/, (m) => `${m[1]} day(s) ago`],
  [/^agora$/, () => 'now'],
  [/^(\d+) membros$/, (m) => `${m[1]} members`],
  [/^(\d+) de (\d+) selos desbloqueados$/, (m) => `${m[1]} of ${m[2]} badges unlocked`],
  [/^(\d+) dias? pro seu marco de (\d+) dias$/, (m) => `${m[1]} day(s) to your ${m[2]}-day milestone`],
  [/^(\d+) dias seguidos!$/, (m) => `${m[1]} days in a row!`]
];

(function iniciarTraducaoIngles() {
  if (typeof idiomaAtual === 'undefined' || idiomaAtual !== 'en') return; // português: não faz nada (custo zero)
  document.documentElement.lang = 'en';
  // prefixos conhecidos, do maior pro menor (assim "❌ erro ao enviar:" ganha de "❌ erro:")
  const prefixos = Object.keys(EN_UI).filter(k => /:$|^📻|^❌ erro/.test(k)).sort((a, b) => b.length - a.length);

  function traduzirTexto(original) {
    if (!original) return null;
    const limpo = original.replace(/\s+/g, ' ').trim();
    if (!limpo) return null;
    if (EN_UI[limpo]) return original.replace(original.trim(), EN_UI[limpo]);
    for (const [re, fn] of EN_REGRAS) { const m = limpo.match(re); if (m) return original.replace(original.trim(), fn(m)); }
    for (const p of prefixos) {
      if (limpo.startsWith(p + ' ')) return original.replace(p, EN_UI[p]);
    }
    return null;
  }

  function traduzirAtributos(el) {
    ['placeholder', 'title', 'aria-label'].forEach(attr => {
      if (el.hasAttribute(attr)) {
        const novo = traduzirTexto(el.getAttribute(attr));
        if (novo !== null) el.setAttribute(attr, novo);
      }
    });
  }

  function traduzirNo(raiz) {
    if (raiz.nodeType === Node.TEXT_NODE) {
      const novo = traduzirTexto(raiz.nodeValue);
      if (novo !== null && novo !== raiz.nodeValue) raiz.nodeValue = novo;
      return;
    }
    if (raiz.nodeType !== Node.ELEMENT_NODE || raiz.tagName === 'SCRIPT' || raiz.tagName === 'STYLE') return;
    traduzirAtributos(raiz);
    // percorre todos os textos e elementos lá dentro
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let no = walker.nextNode();
    while (no) {
      if (no.nodeType === Node.TEXT_NODE) {
        const novo = traduzirTexto(no.nodeValue);
        if (novo !== null && novo !== no.nodeValue) no.nodeValue = novo;
      } else {
        traduzirAtributos(no);
      }
      no = walker.nextNode();
    }
  }

  traduzirNo(document.body);
  // tudo que aparecer depois (toasts, listas, popups) é traduzido na hora em que aparece
  new MutationObserver((mudancas) => {
    for (const m of mudancas) {
      if (m.type === 'characterData') traduzirNo(m.target);
      else m.addedNodes.forEach(traduzirNo);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
