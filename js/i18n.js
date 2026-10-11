/* js/i18n.js — Idiomas do app (português e inglês)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.

   COMO FUNCIONA (pra aprender):
   - Em vez de escrever o texto direto no código ("nova folha"), a gente escreve
     uma CHAVE: t('diario_nova_folha'). A função t() olha o idioma atual e devolve
     o texto certo do dicionário abaixo.
   - Pra traduzir uma tela nova, basta acrescentar a mesma chave nos dois idiomas.
   - Se uma chave faltar em inglês, t() cai pro português (melhor mostrar algo
     do que mostrar a chave crua pro usuário).
   - Textos com número usam {n}: t('folha_x_de_y', { atual: 2, total: 9 }).

   Por enquanto o app inteiro ainda fala português (as telas antigas têm o texto
   escrito direto no HTML). As telas novas já nascem usando t(), assim quando
   o seletor de idioma chegar, elas já estão prontas. */

const TEXTOS = {
  pt: {
    diario_titulo: 'Meu Diário',
    diario_placeholder: 'Folha em branco. Escreva o que quiser...',
    diario_guardar: 'guardar folha',
    diario_nova_folha: 'nova folha',
    diario_guardado: '🔒 Guardado só pra você',
    diario_folha_x_de_y: 'folha {atual} de {total}',
    diario_letra_titulo: 'Letra do diário',
    diario_letra_sub: 'Muda só a letra das suas folhas. O papel continua o mesmo.',
    diario_letra_exemplo: 'querido diário',
    diario_letra_forma: 'Letra de forma',
    diario_neste_dia_mes: 'neste dia · há 1 mês você escreveu',
    diario_neste_dia_ano: 'neste dia · há 1 ano você escreveu',
    diario_lembranca_mes: 'lembrança · há 1 mês',
    diario_lembranca_ano: 'lembrança · há 1 ano',
    diario_fixar: 'Fixar no começo do diário',
    diario_desafixar: 'Desafixar',
    diario_compartilhar: 'Compartilhar esta folha',
    diario_apagar: 'Apagar esta folha',
    diario_trocar_letra: 'Trocar a letra',
    pilula_dias: '{n} dias escrevendo',
    pilula_dia: '1 dia escrevendo',
    pilula_zero: 'começando a escrever',
    pilula_rotulo_um: 'dia escrevendo',
    pilula_rotulo_varios: 'dias escrevendo'
  },
  en: {
    diario_titulo: 'My Diary',
    diario_placeholder: 'A blank page. Write whatever you want...',
    diario_guardar: 'keep page',
    diario_nova_folha: 'new page',
    diario_guardado: '🔒 Kept just for you',
    diario_folha_x_de_y: 'page {atual} of {total}',
    diario_letra_titulo: 'Diary handwriting',
    diario_letra_sub: 'Only the handwriting changes. The paper stays the same.',
    diario_letra_exemplo: 'dear diary',
    diario_letra_forma: 'Print',
    diario_neste_dia_mes: 'on this day · 1 month ago you wrote',
    diario_neste_dia_ano: 'on this day · 1 year ago you wrote',
    diario_lembranca_mes: 'memory · 1 month ago',
    diario_lembranca_ano: 'memory · 1 year ago',
    diario_fixar: 'Pin to the start of the diary',
    diario_desafixar: 'Unpin',
    diario_compartilhar: 'Share this page',
    diario_apagar: 'Delete this page',
    diario_trocar_letra: 'Change handwriting',
    pilula_dias: '{n} days writing',
    pilula_dia: '1 day writing',
    pilula_zero: 'starting to write',
    pilula_rotulo_um: 'day writing',
    pilula_rotulo_varios: 'days writing'
  }
};

// idioma guardado no aparelho; por enquanto o padrão é sempre português
// (o seletor em Configurações chega junto com a tradução do resto do app)
let idiomaAtual = 'pt';
try { idiomaAtual = localStorage.getItem('atomoIdioma') || 'pt'; } catch (e) { /* sem storage: fica pt */ }
if (!TEXTOS[idiomaAtual]) idiomaAtual = 'pt';

// t('chave', { n: 3 }) → texto no idioma atual, com {n} trocado pelo valor
function t(chave, valores) {
  const texto = (TEXTOS[idiomaAtual] && TEXTOS[idiomaAtual][chave]) || TEXTOS.pt[chave] || chave;
  if (!valores) return texto;
  return texto.replace(/\{(\w+)\}/g, (_, nome) => (valores[nome] !== undefined ? valores[nome] : ''));
}
window.t = t;

// formato de data e número do idioma atual ("11 de outubro de 2026" / "October 11, 2026")
function localeAtual() { return idiomaAtual === 'en' ? 'en-US' : 'pt-BR'; }
window.localeAtual = localeAtual;
