/* js/versao.js — A VERSÃO DO ÁTOMO, escrita num lugar só.
   Usada por: Configurações (mostra "Átomo · versão X") e pelo sw.js (o nome do cache
   é montado com ela). Então, pra publicar uma mudança, é só subir o número AQUI.

   Padrão "versionamento semântico": MAIOR.MENOR.CORREÇÃO
   - CORREÇÃO (3º número): conserto ou ajuste pequeno ........ 0.9.0 → 0.9.1
   - MENOR    (2º número): função nova ......................... 0.9.1 → 0.10.0
   - MAIOR    (1º número): mudança grande / lançamento ......... 0.x.x → 1.0.0
   Quando um número sobe, os da direita voltam a zero. O "0" na frente = ainda não lançado.
   No lançamento na Play Store: 1.0.0.

   Este arquivo roda em DOIS lugares: na página (window) e no service worker (self).
   Por isso usa "self", que existe nos dois. */
self.VERSAO_APP = '0.9.3';
