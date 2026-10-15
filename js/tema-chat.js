// tema-chat.js — fundos que o usuário pode escolher para a conversa (DM).
// Cada tema ("gaveta") guarda todas as cores que precisam mudar juntas,
// pra que num fundo escuro o texto continue legível.
// O nome da gaveta (creme, azul...) é o que fica salvo no banco: sempre minúsculo e sem acento.
const TEMAS_CHAT = {
    creme: {
        nome: 'Creme',
        fundo: '#F6F2EB',
        recebido: '#FFFFFF',
        enviado: '#D07B60',
        texto: '#2C2925',
        sub: '#8E867B',
        borda: '#E5DDD1',
        superficie: '#FFFFFF',
        escuro: false
    },
    azul: {
        nome: 'Azul',
        fundo: '#DCEBF8',
        recebido: '#FFFFFF',
        enviado: '#3E86C9',
        texto: '#1C2733',
        sub: '#6A7D90',
        borda: '#C3D8EC',
        superficie: '#FFFFFF',
        escuro: false
    },
    salvia: {
        nome: 'Sálvia',
        fundo: '#E2EAE0',
        recebido: '#FFFFFF',
        enviado: '#6E8569',
        texto: '#24302A',
        sub: '#6E7F6B',
        borda: '#CBD8C8',
        superficie: '#FFFFFF',
        escuro: false
    },
    rosa: {
        nome: 'Rosa',
        fundo: '#F8E6E6',
        recebido: '#FFFFFF',
        enviado: '#C46A7A',
        texto: '#33262A',
        sub: '#957A80',
        borda: '#ECCFD0',
        superficie: '#FFFFFF',
        escuro: false
    },
    branco: {
        nome: 'Branco',
        fundo: '#FFFFFF',
        recebido: '#EFEFF1',
        enviado: '#D07B60',
        texto: '#1C1C1E',
        sub: '#8E8E93',
        borda: '#E6E6E8',
        superficie: '#F4F4F5',
        escuro: false
    },
    lavanda: {
        nome: 'Lavanda',
        fundo: '#E9E5F5',
        recebido: '#FFFFFF',
        enviado: '#7C6BB8',
        texto: '#27233A',
        sub: '#7D7697',
        borda: '#D6CFEB',
        superficie: '#FFFFFF',
        escuro: false
    },
    grafite: {
        nome: 'Grafite',
        fundo: '#2A2C30',
        recebido: '#3A3D43',
        enviado: '#869B83',
        texto: '#F2F2F3',
        sub: '#9EA2A8',
        borda: '#40444A',
        superficie: '#35383D',
        escuro: true
    },
    preto: {
        nome: 'Preto',
        fundo: '#000000',
        recebido: '#26262A',
        enviado: '#D07B60',
        texto: '#F5F5F7',
        sub: '#8E8E93',
        borda: '#2C2C2E',
        superficie: '#1C1C1E',
        escuro: true
    },
};

function pegarTemaChat(id) {
    return TEMAS_CHAT[id] || TEMAS_CHAT.creme;
}


