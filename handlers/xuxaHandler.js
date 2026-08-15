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
    "O Pietro é...",
    "Tema Livre (Qualquer bosta)"
];

const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

function getTodayDateString() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function extractRawNumber(idStr) {
    if (!idStr) return '';
    return String(idStr).split('@')[0].split(':')[0].trim();
}

function isUserPlayed(participant, userCounts) {
    if (!participant || !participant.id) return false;
    const pId = participant.id._serialized || participant.id;
    const pNum = extractRawNumber(pId);

    for (const key of Object.keys(userCounts || {})) {
        if (key === pId) return true;
        const keyNum = extractRawNumber(key);
        if (keyNum && pNum && keyNum === pNum) return true;
    }
    return false;
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
                gameStarted: data.gameStarted !== undefined ? data.gameStarted : false,
                gameCompletedToday: data.gameCompletedToday !== undefined ? data.gameCompletedToday : false
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
        gameStarted: false,
        gameCompletedToday: false
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
    const userNum = extractRawNumber(userId);
    const participant = chat.participants.find(p => p.id._serialized === userId || extractRawNumber(p.id._serialized) === userNum);
    return participant ? (participant.isAdmin || participant.isSuperAdmin) : false;
}

async function banUser(chat, client, userId, reason) {
    if (await isUserAdmin(chat, userId)) {
        console.log(`[Xuxa Game] Admin ${userId} cometeu infração ("${reason}"), mas é admin e não foi banido.`);
        return false;
    }

    const botId = client?.info?.wid?._serialized;
    if (botId && (userId === botId || extractRawNumber(userId) === extractRawNumber(botId))) {
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
A palavra/expressão enviada é "${palavra}".

Diretrizes de avaliação:
1. Verifique se a palavra ou expressão "${palavra}" começa com a letra "${letra}" (ignorando maiúsculas/minúsculas e acentos como Á, É, Í, Ó, Ú).
2. Verifique a relação com o tema "${tema}":
   - Para "Esportes ou Atletas": Aceite QUALQUER esporte, modalidade, arte marcial, jogo ou disciplina esportiva (ex: Iatismo, Kung Fu, Karatê, Esgrima, Luta Livre, Handebol, Natação, Rugby, Tênis, etc.) E TAMBÉM primeiros nomes, sobrenomes, apelidos ou nomes completos de atletas, jogadores, treinadores ou personalidades do esporte (ex: Tatum, Jayson Tatum, Pelé, Marta, Dunga, Chris Paul, Messi, LeBron, etc.).
   - Para "Objetos": A palavra DEVE ser um objeto físico/concreto do mundo real. Conceitos abstratos ou gírias (ex: "vácuo") devem ser REPROVADOS ("NAO").
   - Para "O Pietro é...": Qualquer adjetivo, característica, xingamento ou qualidade é VÁLIDO.

Responda EXATAMENTE "SIM" se for uma resposta válida para o tema e letra, ou "NAO" se for inválida. Responda apenas essa palavra.`;

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

function gerarPalavraParaLetraA(tema) {
    const t = (tema || '').toLowerCase();

    if (t.includes("esporte")) return "Atletismo";
    if (t.includes("filme") || t.includes("série") || t.includes("desenho")) return "Avatar";
    if (t.includes("comida") || t.includes("bebida") || t.includes("sobremesa")) return "Arroz";
    if (t.includes("país") || t.includes("pais") || t.includes("cidade") || t.includes("capital")) return "Alemanha";
    if (t.includes("animal") || t.includes("inseto") || t.includes("seres")) return "Águia";
    if (t.includes("marca") || t.includes("empresa") || t.includes("produto")) return "Apple";
    if (t.includes("famoso") || t.includes("celebridade") || t.includes("histórico")) return "Ayrton Senna";
    if (t.includes("jogo") || t.includes("game")) return "Among Us";
    if (t.includes("objeto")) return "Abajur";
    if (t.includes("profissão") || t.includes("profissao") || t.includes("estudo")) return "Advogado";
    if (t.includes("corpo") || t.includes("anatomia")) return "Abdômen";
    if (t.includes("música") || t.includes("musica") || t.includes("banda") || t.includes("cantor")) return "Anitta";
    if (t.includes("vilão") || t.includes("vilao")) return "Apocalipse";
    if (t.includes("fruta") || t.includes("verdura") || t.includes("legume")) return "Abacaxi";
    if (t.includes("pietro")) return "Amoroso";

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

async function executeDailyReset(client) {
    const state = loadGameState();
    const todayStr = getTodayDateString();

    try {
        const chat = await client.getChatById(XUXA_GROUP_ID);
        if (!chat || !chat.participants) {
            console.error("Grupo ABCdário da Xuxa não encontrado ao executar reset diário.");
            return;
        }

        const playedUserIds = state.userCounts || {};
        const wasGameActiveYesterday = state.gameStarted && !state.gameCompletedToday && Object.keys(playedUserIds).length > 0;
        const botId = client?.info?.wid?._serialized;

        // Se o jogo de ontem NÃO terminou no Z (ficou incompleto às 00:01), bane quem não participou ontem
        if (wasGameActiveYesterday) {
            const unplayedNonAdmins = [];
            for (const p of chat.participants) {
                const isAdmin = p.isAdmin || p.isSuperAdmin;
                const isBot = botId && (p.id._serialized === botId || extractRawNumber(p.id._serialized) === extractRawNumber(botId));
                if (!isAdmin && !isBot && !isUserPlayed(p, playedUserIds)) {
                    unplayedNonAdmins.push(p.id._serialized);
                }
            }

            if (unplayedNonAdmins.length > 0) {
                console.log(`[Xuxa Game] Reset 00:01. Banindo silenciosamente ${unplayedNonAdmins.length} membro(s) não participantes do dia anterior...`);
                try {
                    await chat.removeParticipants(unplayedNonAdmins);
                } catch (err) {
                    console.error("Erro ao banir não participantes no reset 00:01:", err.message);
                }
            }
        } else {
            console.log("[Xuxa Game] O jogo anterior foi concluído no Z ou era primeira execução. Nenhum banimento aplicado no reset das 00:01.");
        }

        // Sorteia novo tema e reseta para a nova rodada
        const newTheme = getRandomTheme(state.theme);
        const botWordA = await gerarPalavraParaLetraA(newTheme);

        const newState = {
            currentLetter: 'B',
            theme: newTheme,
            userCounts: {},
            lastResetDate: todayStr,
            gameStarted: true,
            gameCompletedToday: false
        };
        saveGameState(newState);

        // 1ª Mensagem: Regras de Sobrevivência
        await chat.sendMessage(buildRulesText());

        // 2ª Mensagem: Tema de Hoje
        await chat.sendMessage(`TEMA DE HOJE: ${newTheme}`);

        // 3ª Mensagem: A de [Palavra]
        await chat.sendMessage(`A de ${botWordA}`);
    } catch (err) {
        console.error("Erro no executeDailyReset:", err);
    }
}

async function checkDailyXuxaReset(client) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = getTodayDateString();

    const state = loadGameState();
    // Executa às 00:01 AM se ainda não rodou hoje
    if (hours === 0 && minutes === 1 && state.lastResetDate !== todayStr) {
        console.log(`[Xuxa Game] Executando reset diário automático das 00:01 (${todayStr})...`);
        await executeDailyReset(client);
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

        // Se a rodada não começou ou o jogo já foi concluído hoje (após o Z), ignora a mensagem (grupo livre)
        if (!state.gameStarted || state.gameCompletedToday) {
            return false;
        }

        const chat = await message.getChat();
        const expectedLetter = state.currentLetter.toUpperCase();

        // Procura entre as linhas da mensagem pela linha no formato "<Letra> de <Palavra>"
        const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
        let match = null;
        for (const line of lines) {
            const m = line.match(/^([a-zà-ÿ])\s+de\s+(.+)$/i);
            if (m) {
                if (m[1].toUpperCase() === expectedLetter) {
                    match = m;
                    break;
                }
                if (!match) match = m;
            }
        }

        // Durante o jogo ativo, QUALQUER mensagem de participante que não siga o formato "X de Y" resulta em BAN!
        if (!match) {
            await banUser(chat, client, senderId, 'Conversou durante o jogo ou não usou o formato "X de Y" (ex: "A de Amor").');
            return true;
        }

        const inputLetter = match[1].toUpperCase();
        const inputPhrase = match[2].trim();

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

        // Registra a jogada do usuário no mapa (usando tanto o senderId quanto o número bruto)
        state.userCounts[senderId] = (state.userCounts[senderId] || 0) + 1;
        const rawSenderNum = extractRawNumber(senderId);
        if (rawSenderNum) {
            state.userCounts[rawSenderNum] = (state.userCounts[rawSenderNum] || 0) + 1;
        }

        const currentIndex = ALPHABET.indexOf(expectedLetter);

        // SE CHEGOU NA LETRA Z (CONCLUSÃO DO ALFABETO)
        if (expectedLetter === 'Z' || currentIndex === ALPHABET.length - 1) {
            await message.reply(`*${inputLetter} de ${inputPhrase}* APROVADO!`);

            saveGameState(state);

            // Audit de banimento silencioso APENAS de quem não jogou NENHUMA vez nesta rodada
            const playedMap = state.userCounts || {};
            const botId = client?.info?.wid?._serialized;
            const unplayedNonAdmins = [];

            for (const p of chat.participants) {
                const isAdmin = p.isAdmin || p.isSuperAdmin;
                const isBot = botId && (p.id._serialized === botId || extractRawNumber(p.id._serialized) === extractRawNumber(botId));

                if (!isAdmin && !isBot && !isUserPlayed(p, playedMap)) {
                    unplayedNonAdmins.push(p.id._serialized);
                }
            }

            if (unplayedNonAdmins.length > 0) {
                console.log(`[Xuxa Game] Alfabeto Z concluído! Banindo silenciosamente ${unplayedNonAdmins.length} membro(s) não participantes...`);
                try {
                    await chat.removeParticipants(unplayedNonAdmins);
                } catch (err) {
                    console.error("Erro ao banir não participantes ao concluir Z:", err.message);
                }
            }

            // Marca o jogo como concluído hoje (bloqueia novos jogos até 00:01 AM de amanhã)
            state.gameCompletedToday = true;
            state.gameStarted = false;
            saveGameState(state);

            await chat.sendMessage("CONSEGUIRAM! O ALFABETO FOI CONCLUÍDO!\n\nAproveitem o dia livre! Até as 00:01 ninguém mais é banido.");
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
    executeDailyReset
};
