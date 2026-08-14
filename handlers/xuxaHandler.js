// handlers/xuxaHandler.js
const fs = require('fs');
const path = require('path');
const { perguntarIA } = require('../services/aiService');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf8'));
const XUXA_GROUP_ID = CONFIG.xuxaGroup || "5511998848997-1604500469@g.us";
const STATE_FILE = path.join(__dirname, 'assets/xuxa_state.json');

const THEMES = [
    "Filmes, Séries ou Desenhos",
    "Comidas, Bebidas ou Sobremesas",
    "Países, Cidades ou Capitais",
    "Animais, Insetos ou Seres Vivos",
    "Marcas, Empresas ou Produtos",
    "Famosos, Celebridades ou Personagens Históricos",
    "Jogos, Games ou Personagens de Games",
    "Objetos do Dia a Dia",
    "Profissões ou Áreas de Estudo",
    "Partes do Corpo Humano ou Anatomia",
    "Músicas, Bandas ou Cantores",
    "Esportes ou Atletas",
    "Vilões de Filmes ou Desenhos",
    "Frutas, Verduras ou Legumes",
    "Tema Livre (Qualquer bosta)"
];

const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

function getTodayDateString() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function loadGameState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            return {
                currentLetter: data.currentLetter || 'A',
                theme: data.theme || THEMES[0],
                userCounts: data.userCounts || {},
                lastResetDate: data.lastResetDate || '',
                gameStarted: data.gameStarted !== undefined ? data.gameStarted : false
            };
        }
    } catch (e) {
        console.error("Erro ao carregar estado do ABCdário da Xuxa:", e);
    }
    return {
        currentLetter: 'A',
        theme: THEMES[0],
        userCounts: {},
        lastResetDate: '',
        gameStarted: false
    };
}

function saveGameState(state) {
    try {
        const dir = path.dirname(STATE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
        console.error("Erro ao salvar estado do ABCdário da Xuxa:", e);
    }
}

function getRandomTheme(currentTheme) {
    const available = THEMES.filter(t => t !== currentTheme);
    return available[Math.floor(Math.random() * available.length)];
}

function getSenderId(message) {
    return message.author ||
        message._data?.author ||
        message._data?.authorId ||
        message._data?.id?.participant ||
        message.from ||
        null;
}

async function isUserAdmin(chat, userId) {
    if (!chat || !chat.participants) return false;
    const participant = chat.participants.find(p => p.id._serialized === userId);
    return participant ? (participant.isAdmin || participant.isSuperAdmin) : false;
}

async function banUser(chat, client, userId, reason) {
    if (await isUserAdmin(chat, userId)) {
        console.log(`[Xuxa Game] Admin ${userId} cometeu infração ("${reason}"), mas é admin e não foi banido.`);
        return false;
    }

    const botId = client?.info?.wid?._serialized;
    if (botId && userId === botId) {
        return false;
    }

    try {
        console.log(`[Xuxa Game] Banindo silenciosamente ${userId}. Motivo: ${reason}`);
        await chat.removeParticipants([userId]);
        return true;
    } catch (err) {
        console.error(`Erro ao banir usuário ${userId}:`, err.message);
        return false;
    }
}

async function validarComIA(letra, palavra, tema) {
    const prompt = `Você é o juiz do jogo de palavras "ABCdário da Xuxa".
A letra da rodada é "${letra}".
O tema é "${tema}".
A palavra enviada é "${palavra}".

Avalie com bom senso (aceite gírias populares, nomes em inglês, cidades, países, marcas e acentuações):
1. A palavra ou expressão "${palavra}" começa com a letra "${letra}" (ou sua forma acentuada Á, É, Í, Ó, Ú)?
2. A palavra pertence ou tem relação lógica com o tema "${tema}"?

Responda APENAS "SIM" se ambas as condições forem verdadeiras.
Responda APENAS "NAO" se for uma palavra totalmente sem sentido, de tema totalmente diferente, ou que comece com outra letra.`;

    try {
        const resposta = await perguntarIA([{ role: "user", content: prompt }]);
        const limpo = resposta.trim().toUpperCase();
        return limpo.startsWith("SIM");
    } catch (e) {
        console.error("Erro ao validar palavra com IA no Xuxa Game:", e.message);
        const palavras = palavra.trim().split(/\s+/);
        const primeira = palavras[0] || '';
        return primeira.toUpperCase().startsWith(letra.toUpperCase());
    }
}

async function gerarPalavraParaLetraA(tema) {
    const prompt = `Escolha uma única palavra ou nome próprio muito conhecido que comece com a letra "A" e que pertença ao tema "${tema}".
Responda APENAS com essa palavra ou expressão curta, sem frases longas nem pontuação.`;
    try {
        const resposta = await perguntarIA([{ role: "user", content: prompt }]);
        const limpo = resposta.trim().replace(/^A\s+de\s+/i, '').replace(/[^a-zA-Zá-úÁ-Úà-ùÀ-Ùã-õÃ-Õâ-ûÂ-ÛçÇ0-9\s-]/g, '');
        if (limpo && limpo.length > 0) return limpo;
    } catch (e) {
        console.error("Erro ao gerar palavra para letra A com IA:", e.message);
    }
    return "Amor";
}

function buildRulesText() {
    return `REGRAS DO ABCdário DA XUXA (LEIA COM ATENÇÃO!)

REGRAS DE SOBREVIVÊNCIA:
• Não usou o formato "A de Amor"? BAN.
• Não falou no dia? BAN.
• Letra fora da ordem alfabética? BAN.
• Palavra fora do tema? BAN.
• Acabou o alfabeto (Z) sem você ter falado? BAN.
• Falou MAIS de 3 palavras no mesmo dia? BAN.`;
}

async function executeRoundResetAndBans(client, reasonLabel) {
    const state = loadGameState();
    const todayStr = getTodayDateString();

    try {
        const chat = await client.getChatById(XUXA_GROUP_ID);
        if (!chat || !chat.participants) {
            console.error("Grupo ABCdário da Xuxa não encontrado ao resetar rodada.");
            return;
        }

        const playedUserIds = Object.keys(state.userCounts || {});
        const unplayedNonAdmins = [];

        const botId = client?.info?.wid?._serialized;

        for (const p of chat.participants) {
            const pid = p.id._serialized;
            const isAdmin = p.isAdmin || p.isSuperAdmin;
            const isBot = botId && pid === botId;

            if (!isAdmin && !isBot && !playedUserIds.includes(pid)) {
                unplayedNonAdmins.push(pid);
            }
        }

        if (unplayedNonAdmins.length > 0) {
            console.log(`[Xuxa Game] Banindo silenciosamente ${unplayedNonAdmins.length} membro(s) não participantes...`);
            try {
                await chat.removeParticipants(unplayedNonAdmins);
            } catch (err) {
                console.error("Erro ao banir não participantes em lote:", err.message);
            }
        }

        const newTheme = getRandomTheme(state.theme);
        const botWordA = await gerarPalavraParaLetraA(newTheme);

        const newState = {
            currentLetter: 'B',
            theme: newTheme,
            userCounts: {},
            lastResetDate: todayStr,
            gameStarted: true
        };
        saveGameState(newState);

        // 1ª Mensagem: Regras de Sobrevivência
        await chat.sendMessage(buildRulesText());

        // 2ª Mensagem: Tema de Hoje
        await chat.sendMessage(`TEMA DE HOJE: ${newTheme}`);

        // 3ª Mensagem: A de [Palavra]
        await chat.sendMessage(`A de ${botWordA}`);
    } catch (err) {
        console.error("Erro no executeRoundResetAndBans:", err);
    }
}

async function checkDailyXuxaReset(client) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = getTodayDateString();

    const state = loadGameState();
    if (hours === 0 && minutes === 1 && state.lastResetDate !== todayStr) {
        console.log(`[Xuxa Game] Executando reset diário automático das 00:01 (${todayStr})...`);
        await executeRoundResetAndBans(client, "Reset Diário 00:01 AM");
    }
}

async function handleXuxaGameMessage(message, client) {
    try {
        if (!message || !message.from || message.from !== XUXA_GROUP_ID) {
            return false;
        }

        const body = message.body ? message.body.trim() : '';
        if (!body) return false;

        const senderId = getSenderId(message);
        if (!senderId) return false;

        const state = loadGameState();

        // Se a rodada ainda não começou (antes do reset automático das 00:01 AM), ignora conversas normais
        if (!state.gameStarted) {
            return false;
        }

        const chat = await message.getChat();

        // Pega a primeira linha da mensagem
        const firstLine = body.split('\n')[0].trim();

        // Se a mensagem parecer uma tentativa de jogada mas não seguir o formato "X de Y":
        const isAttempt = /^([a-zÀ-ÿ])(\s*[:\-\=]|\s+[a-zÀ-ÿ]+)/i.test(firstLine) || /^letra\s+[a-z]/i.test(firstLine);
        const match = firstLine.match(/^([a-zà-ÿ])\s+de\s+(.+)$/i);

        if (!match) {
            if (isAttempt) {
                await banUser(chat, client, senderId, 'Não usou o formato correto "X de Y" (ex: "A de Amor").');
                return true;
            }
            return false;
        }

        const inputLetter = match[1].toUpperCase();
        const inputPhrase = match[2].trim();
        const expectedLetter = state.currentLetter.toUpperCase();

        const currentCount = state.userCounts[senderId] || 0;
        if (currentCount >= 3) {
            await banUser(chat, client, senderId, "Falou MAIS de 3 palavras no mesmo dia/rodada.");
            return true;
        }

        if (inputLetter !== expectedLetter) {
            await banUser(chat, client, senderId, `Letra fora da ordem alfabética. Esperado: ${expectedLetter}, Enviado: ${inputLetter}.`);
            return true;
        }

        const aprovado = await validarComIA(expectedLetter, inputPhrase, state.theme);
        if (!aprovado) {
            await banUser(chat, client, senderId, `Palavra "${inputPhrase}" recusada para o tema "${state.theme}".`);
            return true;
        }

        state.userCounts[senderId] = (state.userCounts[senderId] || 0) + 1;

        const currentIndex = ALPHABET.indexOf(expectedLetter);

        if (expectedLetter === 'Z' || currentIndex === ALPHABET.length - 1) {
            await message.reply(`*${inputLetter} de ${inputPhrase}* APROVADO!\n\nO ALFABETO FOI CONCLUÍDO!`);
            saveGameState(state);
            await executeRoundResetAndBans(client, "Alfabeto Concluído (Letra Z)");
            return true;
        }

        const nextLetter = ALPHABET[currentIndex + 1];
        state.currentLetter = nextLetter;
        saveGameState(state);

        await message.reply(`*${inputLetter} de ${inputPhrase}* APROVADO!\nPróxima letra: *${nextLetter}*`);
        return true;
    } catch (err) {
        console.error("Erro no handleXuxaGameMessage:", err);
        return false;
    }
}

module.exports = {
    handleXuxaGameMessage,
    checkDailyXuxaReset,
    executeRoundResetAndBans
};
