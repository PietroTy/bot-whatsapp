// handlers/xuxaHandler.js
const fs = require('fs');
const path = require('path');
const { perguntarIA } = require('../services/aiService');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf8'));
const XUXA_GROUP_ID = CONFIG.xuxaGroup || "5511998848997-1604500469@g.us";
const STATE_FILE = path.join(__dirname, 'assets/xuxa_state.json');

const ADMIN_NUMBERS = new Set([
    '5516997335358',
    '5511937683694',
    ...(CONFIG.adminNumbers || [])
]);

const THEMES = [
    "Desenhos",
    "Cabe na Mão",
    "CEP",
    "Animais",
    "Gente Famosa",
    "Jogos",
    "Objetos do Dia a Dia",
    "Profissões",
    "Corpo Humano",
    "Músicas",
    "Esportes",
    "Vilões",
    "Tem na Feira",
    "O Pietro é...",
    "Tema Livre (Qualquer bosta)",
    "ABC da Xuxa (O Original)"
];

const ALPHABET_ABC = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const ALPHABET_AEIOU = ['A', 'E', 'I', 'O', 'U'];

function getTodayDateString() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function extractRawNumber(idStr) {
    if (!idStr) return '';
    return String(idStr).split('@')[0].split(':')[0].trim();
}

function getAlphabetForMode(mode) {
    return (mode && mode.startsWith('AEIOU')) ? ALPHABET_AEIOU : ALPHABET_ABC;
}

function getMaxWordsForMode(mode, state = {}) {
    if (mode === 'ABC_1') return 1;
    if (mode === 'ABC_2') return 3;
    if (mode === 'AEIOU_1') return 2;
    if (mode === 'AEIOU_2') {
        const days = state.aeiouDaysCount || 4;
        const extra = Math.max(0, days - 3);
        return 2 + extra;
    }
    // Fallback legado
    return mode === 'AEIOU' ? 2 : 3;
}

function getNonAdminParticipants(chat, botId) {
    if (!chat || !chat.participants) return [];
    return chat.participants.filter(p => {
        const pRaw = extractRawNumber(p.id?._serialized);
        const pLidRaw = p.lid ? extractRawNumber(p.lid._serialized) : null;
        const isAdminByConfig = (pRaw && ADMIN_NUMBERS.has(pRaw)) || (pLidRaw && ADMIN_NUMBERS.has(pLidRaw));
        const isAdmin = p.isAdmin || p.isSuperAdmin || isAdminByConfig;
        const isBot = botId && (p.id?._serialized === botId || extractRawNumber(p.id?._serialized) === extractRawNumber(botId));
        return !isAdmin && !isBot;
    });
}

function isUserPlayed(participant, userCounts, addedMidGameUsers = [], addedUsersTimestamps = {}) {
    if (!participant) return false;
    
    const idsToCheck = new Set();

    if (participant.id) {
        if (participant.id._serialized) idsToCheck.add(participant.id._serialized);
        if (participant.id.user) idsToCheck.add(participant.id.user);
        const raw = extractRawNumber(participant.id._serialized);
        if (raw) idsToCheck.add(raw);
    }

    if (participant.lid) {
        if (participant.lid._serialized) idsToCheck.add(participant.lid._serialized);
        if (participant.lid.user) idsToCheck.add(participant.lid.user);
        const rawLid = extractRawNumber(participant.lid._serialized);
        if (rawLid) idsToCheck.add(rawLid);
    }

    const now = Date.now();
    const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

    for (const id of idsToCheck) {
        if (!id) continue;

        // Imunidade de adicionado mid-game
        if (Array.isArray(addedMidGameUsers) && addedMidGameUsers.includes(id)) {
            console.log(`[Xuxa Game] Participante ${id} está na lista de imunidade mid-game. Imune ao expurgo!`);
            return true;
        }

        // Imunidade de 48 horas desde a adição
        if (addedUsersTimestamps && addedUsersTimestamps[id]) {
            if (now - addedUsersTimestamps[id] < TWO_DAYS_MS) {
                console.log(`[Xuxa Game] Participante ${id} foi adicionado recentemente (há menos de 48h). Imune ao expurgo!`);
                return true;
            }
        }
    }

    if (!userCounts || Object.keys(userCounts).length === 0) return false;

    for (const id of idsToCheck) {
        if (id && userCounts[id] > 0) return true;
    }
    return false;
}

function loadGameState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            return {
                mode: data.mode || 'ABC_2',
                aeiouDaysCount: data.aeiouDaysCount !== undefined ? data.aeiouDaysCount : 0,
                currentLetter: data.currentLetter || 'A',
                theme: data.theme || THEMES[0],
                userCounts: data.userCounts || {},
                addedMidGameUsers: Array.isArray(data.addedMidGameUsers) ? data.addedMidGameUsers : [],
                addedUsersTimestamps: typeof data.addedUsersTimestamps === 'object' && data.addedUsersTimestamps !== null ? data.addedUsersTimestamps : {},
                lastResetDate: data.lastResetDate || '',
                gameStarted: data.gameStarted !== undefined ? data.gameStarted : false,
                gameCompletedToday: data.gameCompletedToday !== undefined ? data.gameCompletedToday : false,
                disableBansToday: data.disableBansToday !== undefined ? data.disableBansToday : false
            };
        }
    } catch (e) {
        console.error("Erro ao carregar estado do ABCdário da Xuxa:", e);
    }
    return {
        mode: 'ABC_2',
        aeiouDaysCount: 0,
        currentLetter: 'A',
        theme: THEMES[0],
        userCounts: {},
        addedMidGameUsers: [],
        addedUsersTimestamps: {},
        lastResetDate: '',
        gameStarted: false,
        gameCompletedToday: false,
        disableBansToday: false
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

function registerJoinedUser(userId) {
    if (!userId) return;
    try {
        const idStr = typeof userId === 'string' ? userId : (userId._serialized || userId.user || String(userId));
        if (!idStr || idStr === '[object Object]') return;

        const state = loadGameState();
        if (!Array.isArray(state.addedMidGameUsers)) {
            state.addedMidGameUsers = [];
        }
        if (!state.addedUsersTimestamps || typeof state.addedUsersTimestamps !== 'object') {
            state.addedUsersTimestamps = {};
        }

        const raw = extractRawNumber(idStr);
        if (idStr && !state.addedMidGameUsers.includes(idStr)) state.addedMidGameUsers.push(idStr);
        if (raw && !state.addedMidGameUsers.includes(raw)) state.addedMidGameUsers.push(raw);
        
        const now = Date.now();
        if (idStr) state.addedUsersTimestamps[idStr] = now;
        if (raw) state.addedUsersTimestamps[raw] = now;

        saveGameState(state);
        console.log(`[Xuxa Game] Membro ${idStr} (raw: ${raw}) registrado como adicionado com imunidade temporária.`);
    } catch (e) {
        console.error("Erro ao registrar entrada de usuário no estado do Xuxa Game:", e);
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
    if (!userId) return false;
    const userNum = extractRawNumber(userId);
    if (userNum && ADMIN_NUMBERS.has(userNum)) return true;

    if (!chat || !chat.participants) return false;
    const participant = chat.participants.find(p => {
        const pRaw = extractRawNumber(p.id?._serialized);
        const pLidRaw = p.lid ? extractRawNumber(p.lid._serialized) : null;
        return (pRaw && pRaw === userNum) || (pLidRaw && pLidRaw === userNum);
    });
    return participant ? (participant.isAdmin || participant.isSuperAdmin) : false;
}

async function checkLastSurvivor(chat, client) {
    if (!chat) return false;
    let targetChat = chat;
    try {
        if (client && chat.id && chat.id._serialized) {
            targetChat = await client.getChatById(chat.id._serialized);
        }
    } catch (err) {
        // Fallback para chat existente
    }

    if (!targetChat || !targetChat.participants) return false;
    const botId = client?.info?.wid?._serialized;
    const nonAdmins = getNonAdminParticipants(targetChat, botId);

    if (nonAdmins.length === 1) {
        const survivor = nonAdmins[0];
        const survivorId = survivor.id._serialized;
        const rawNum = extractRawNumber(survivorId);

        console.log(`[Xuxa Game] Apenas 1 membro não-admin restante (${survivorId}). Promovendo a Admin e encerrando jogo!`);

        try {
            await targetChat.promoteParticipants([survivorId]);
        } catch (err) {
            console.error(`Erro ao promover participante ${survivorId} a admin:`, err.message);
        }

        const xuxatronMsg = `Parabens @${rawNum}!
Voce e o ultimo sobrevivente do jogo da Xuxa!

Voce provou o seu valor e sobreviveu ao expurgo. Como recompensa, foi promovido a administrador do grupo!

O ciclo se reiniciara no proximo reset as 12:00 se houverem novos membros jogaveis.`;

        await targetChat.sendMessage(xuxatronMsg);

        const state = loadGameState();
        state.gameCompletedToday = true;
        state.gameStarted = false;
        saveGameState(state);

        return true;
    } else if (nonAdmins.length === 0) {
        const state = loadGameState();
        if (state.gameStarted && !state.gameCompletedToday) {
            console.log(`[Xuxa Game] 0 membros não-admins restantes. Finalizando jogo por hoje.`);
            state.gameCompletedToday = true;
            state.gameStarted = false;
            saveGameState(state);
            await targetChat.sendMessage(`Nao ha mais participantes nao-admins no grupo. O jogo da Xuxa foi encerrado por hoje.`);
            return true;
        }
    }
    return false;
}

function getRandomVerb() {
    const verbs = [
        'dizimado', 'pulverizado', 'degolado', 'amassado', 'serrado',
        'esquartejado', 'baleado', 'eviscerado', 'decapitado', 'esmagado',
        'triturado', 'fumigado', 'carbonizado', 'exterminado', 'liquidado',
        'vaporizdo', 'despedacado', 'eliminado', 'aniquilado', 'destruido',
        'alvejado', 'fumado', 'espancado', 'morto', 'prensado', 'esfaqueado'
    ];
    return verbs[Math.floor(Math.random() * verbs.length)];
}

function humanizeReason(reason) {
    const r = reason.toLowerCase();
    if (r.includes('letra fora') || r.includes('ordem alfab')) return 'errou a letra';
    if (r.includes('mais de') && r.includes('palavra')) return 'falou demais';
    if (r.includes('conversou') || r.includes('formato')) return 'conversou no grupo';
    if (r.includes('recusada') || r.includes('tema')) return 'a palavra nao bateu com o tema';
    if (r.includes('menos')) return 'falou de menos';
    return reason;
}

async function banUser(chat, client, userId, reason, message = null) {
    const state = loadGameState();
    const todayStr = getTodayDateString();

    // TRAVA DE SEGURANÇA: DATAS PROTEGIDAS OU SE DISABLE_BANS_TODAY ESTIVER ATIVO
    const protectedDates = ['2026-09-10', '2026-09-15', '2026-09-28'];
    const isTodayProtected = protectedDates.includes(todayStr) || state.disableBansToday;
    if (isTodayProtected) {
        console.log(`[Xuxa Game] [PROTEÇÃO HOJE] Membro ${userId} cometeu infração ("${reason}"), mas banimentos estão DESATIVADOS hoje.`);
        return false;
    }

    // TRATAMENTO PARA ADMINS: NÃO BANE, APENAS AVISA
    if (await isUserAdmin(chat, userId)) {
        console.log(`[Xuxa Game] Admin ${userId} cometeu infração ("${reason}"), mas é admin e não foi banido.`);
        if (message) {
            const rawNum = extractRawNumber(userId);
            await message.reply(`cala a boca @${rawNum}.`);
        }
        return false;
    }

    const botId = client?.info?.wid?._serialized;
    if (botId && (userId === botId || extractRawNumber(userId) === extractRawNumber(botId))) {
        return false;
    }

    try {
        console.log(`[Xuxa Game] Banindo ${userId}. Motivo: ${reason}`);
        await chat.removeParticipants([userId]);

        const rawNum = extractRawNumber(userId);
        const currentLetter = state.currentLetter || '?';
        const verb = getRandomVerb();
        const humanReason = humanizeReason(reason);
        const banMsg = `@${rawNum} foi ${verb} pq ${humanReason}\n\nAinda é a letra ${currentLetter}`;
        if (message) {
            await message.reply(banMsg);
        } else {
            await chat.sendMessage(banMsg, { mentions: [userId] });
        }

        await checkLastSurvivor(chat, client);
        return true;
    } catch (err) {
        console.error(`Erro ao banir usuario ${userId}:`, err.message);
        return false;
    }
}

const KNOWN_PLACES_BY_LETTER = {
    'X': new Set([
        "xinyang", "xian", "xiamen", "xuchang", "xiangyang", "xinjiang", "xizang", "xianyang",
        "xining", "xingtai", "xinxiang", "xinyi", "xuanwei", "xanthi", "xalapa", "xanten", "xangai",
        "xanxere", "xique-xique", "xiquexique", "xangrila", "xangri-la", "xambre", "xapuri",
        "xaxim", "xexeu", "xambioa", "xinguara", "xingo", "xique xique", "xai-xai", "xaixai"
    ])
};

function isKnownCityOrPlace(palavra, letra) {
    if (!palavra || !letra) return false;
    const l = letra.toUpperCase();
    const list = KNOWN_PLACES_BY_LETTER[l];
    if (!list) return false;

    const norm = palavra.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    return list.has(norm);
}

const ORIGINAL_XUXA_WORDS = {
    'A': ['amor'],
    'B': ['baixinho', 'baixinhos'],
    'C': ['coracao'],
    'D': ['doce', 'docinho'],
    'E': ['escola'],
    'F': ['feijao'],
    'G': ['gente'],
    'H': ['humano'],
    'I': ['igualdade'],
    'J': ['juventude'],
    'L': ['liberdade'],
    'M': ['molecagem'],
    'N': ['natureza'],
    'O': ['obrigado', 'obrigada'],
    'P': ['protecao'],
    'Q': ['queroquero', 'quero'],
    'R': ['riacho'],
    'S': ['saudade', 'saudades'],
    'T': ['terra'],
    'U': ['universo'],
    'V': ['vitoria'],
    'X': ['xuxa', 'xodo', 'xaxado', 'xicara'],
    'Z': ['zaza', 'zumzumzum', 'zum']
};

function checkInitialLetterMatchJS(palavra, letraEsperada) {
    if (!palavra || !letraEsperada) return false;
    // Limpa aspas, travessões, pontuação inicial e espaços
    const clean = palavra.replace(/^["'“‘«\-\s]+/, '').trim();
    if (!clean) return false;

    // Normaliza acentos da primeira letra
    const firstChar = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
    return firstChar === letraEsperada.toUpperCase();
}

async function validarComIA(letra, palavra, tema) {
    const expectedLetter = letra.toUpperCase();
    const tLower = (tema || '').toLowerCase();

    // 1. Pré-checagem determinística em JS da letra inicial
    if (!checkInitialLetterMatchJS(palavra, expectedLetter)) {
        console.log(`[Xuxa Game] Recusado em JS: "${palavra}" não começa com a letra "${expectedLetter}".`);
        return false;
    }

    // 2. Tema "ABC da Xuxa (O Original)": validação determinística sem IA (letra oficial da música)
    if (tLower.includes("original") || tLower.includes("abc da xuxa")) {
        const allowed = ORIGINAL_XUXA_WORDS[expectedLetter];
        if (!allowed) {
            // Letras K, W, Y (fora da música de 1988): aceita qualquer palavra iniciada com a letra
            return true;
        }
        const normInput = palavra
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "")
            .trim();

        const isMatch = allowed.includes(normInput);
        if (!isMatch) {
            console.log(`[Xuxa Game] Recusado no Tema Original (JS sem IA): "${palavra}" (norm: "${normInput}") não é a palavra oficial para a letra ${expectedLetter} da Xuxa.`);
        }
        return isMatch;
    }

    if ((tLower.includes("país") || tLower.includes("pais") || tLower.includes("cidade") || tLower.includes("capital") || tLower.includes("cep")) && isKnownCityOrPlace(palavra, expectedLetter)) {
        return true;
    }

    const prompt = `Você é o juiz supremo e super generoso do jogo "ABCdário da Xuxa".
Sua tarefa é avaliar se a palavra/expressão enviada pelo jogador se encaixa no tema proposto.

ENTRADA:
- Letra da rodada: "${expectedLetter}"
- Tema: "${tema}"
- Palavra/Expressão enviada: "${palavra}"

REGRAS DE AVALIAÇÃO:
1. SEJA EXTREMAMENTE GENEROSO, FLEXÍVEL E ABRANGENTE. Não seja pedante! Em caso de dúvida, ACEITE ("valido": true).
2. Para temas de filmes, séries, desenhos, personagens ou vilões, ACEITE OBRIGATORIAMENTE animes, mangás, animações, HQs, desenhos animados, videogames e séries (ex: "Orochimaru" de Naruto é um vilão VÁLIDO para "Vilões de Filmes ou Desenhos", "L" de Death Note é VÁLIDO).
3. Aceite codinomes, siglas, letras únicas ou nomes de 1 ou 2 letras (ex: "Q" de James Bond é VÁLIDO para Q, "V" de V de Vingança para V, "E.T." para E).
4. Aceite expressões com artigos, números ou preposições (ex: "Um Lugar Silencioso" para U, "O Senhor dos Anéis" para O, "A Origem" para A).
5. Aceite nomes de bandas, cantores, filmes, séries, marcas ou personagens em INGLÊS ou Português (ex: "One Direction" para O em Músicas/Bandas, "Iron Man" para I, "Kind" para K se puder significar gentil/caridoso).
6. Aceite cidades, países, vilas ou distritos do Brasil e do mundo (em português ou romanização/pinyin como Xinyang, Xian, Xangai).
7. Apenas RECUSE ("valido": false) se a palavra/expressão NÃO tiver NENHUMA relação plausível com o tema "${tema}".

FORMATO OBRIGATÓRIO DE RESPOSTA (RESPONDA APENAS EM JSON VÁLIDO):
{"valido": true, "motivo": "explicacao curta"}
OU
{"valido": false, "motivo": "explicacao curta"}`;

    try {
        const rawResposta = await perguntarIA([{ role: "user", content: prompt }]);
        let cleanJson = rawResposta.trim();
        // Remove blocos de código markdown se houver
        cleanJson = cleanJson.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

        try {
            const parsed = JSON.parse(cleanJson);
            if (typeof parsed.valido === 'boolean') {
                return parsed.valido;
            }
        } catch (jsonErr) {
            // Fallback robusto por Regex caso a IA não retorne JSON estrito
            console.warn(`[Xuxa Game] Fallback regex na resposta da IA: "${rawResposta}"`);
            if (/\b(SIM|TRUE|VALIDO|VÁLIDO)\b/i.test(rawResposta) && !/\b(NAO|NÃO|FALSE|INVALIDO|INVÁLIDO)\b/i.test(rawResposta)) {
                return true;
            }
            if (/\b(NAO|NÃO|FALSE|INVALIDO|INVÁLIDO)\b/i.test(rawResposta)) {
                return false;
            }
        }
        return true;
    } catch (e) {
        console.error("Erro ao validar palavra com IA no Xuxa Game:", e.message);
        return checkInitialLetterMatchJS(palavra, expectedLetter);
    }
}

function gerarPalavraParaLetraA(tema) {
    const t = (tema || '').toLowerCase();

    if (t.includes("esporte")) return "Atletismo";
    if (t.includes("desenho") || t.includes("filme") || t.includes("série")) return "Avatar";
    if (t.includes("mão") || t.includes("mao")) return "Anel";
    if (t.includes("cep") || t.includes("país") || t.includes("pais") || t.includes("cidade") || t.includes("capital")) return "Alemanha";
    if (t.includes("animal") || t.includes("inseto")) return "Águia";
    if (t.includes("famoso") || t.includes("famosa") || t.includes("celebridade")) return "Ayrton Senna";
    if (t.includes("jogo") || t.includes("game")) return "Among Us";
    if (t.includes("objeto")) return "Abajur";
    if (t.includes("profissão") || t.includes("profissao") || t.includes("estudo")) return "Advogado";
    if (t.includes("corpo") || t.includes("anatomia")) return "Abdômen";
    if (t.includes("música") || t.includes("musica") || t.includes("banda")) return "Anitta";
    if (t.includes("vilão") || t.includes("vilao")) return "Apocalipse";
    if (t.includes("feira") || t.includes("fruta") || t.includes("verdura")) return "Abacaxi";
    if (t.includes("pietro")) return "Amoroso";
    if (t.includes("xuxa")) return "Amor";

    return "Amor";
}

function buildRulesText(mode, maxWords, aeiouDaysCount = 0) {
    if (mode === 'ABC_1') {
        return `Regras de sobrevivencia:
- Formato obrigatorio: "A de Amor".
- Apenas 1 palavra por pessoa por dia.
- Ordem alfabetica (A a Z).
- Palavra fora do tema ou ordem = BAN.
- Nao participou da rodada = BAN no expurgo.`;
    }

    if (mode === 'ABC_2') {
        return `Regras de sobrevivencia:
- Formato obrigatorio: "A de Amor".
- Ate 3 palavras por pessoa por dia.
- Ordem alfabetica (A a Z).
- Palavra fora do tema ou ordem = BAN.
- Nao participou da rodada = BAN no expurgo.`;
    }

    if (mode === 'AEIOU_1') {
        return `Regras de sobrevivencia:
- Formato obrigatorio: "A de Amor".
- Apenas as VOGAIS (A - E - I - O - U).
- Ate 2 palavras por pessoa por dia.
- Palavra fora do tema ou ordem = BAN.
- Nao participou da rodada = BAN no expurgo.`;
    }

    if (mode === 'AEIOU_2') {
        return `Regras de sobrevivencia:
- Formato obrigatorio: "A de Amor".
- Apenas as VOGAIS (A - E - I - O - U).
- Ate ${maxWords} palavras por pessoa por dia.
- Palavra fora do tema ou ordem = BAN.
- Nao participou da rodada = BAN no expurgo.`;
    }

    return `Regras do ABCdario da Xuxa.`;
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

        const botId = client?.info?.wid?._serialized;
        const playedUserIds = state.userCounts || {};
        const addedMidGameUsers = state.addedMidGameUsers || [];
        const isTodayProtected = ['2026-09-10', '2026-09-28'].includes(todayStr) || state.disableBansToday;
        const wasGameActiveYesterday = state.gameStarted && !state.gameCompletedToday && Object.keys(playedUserIds).length > 0;

        // Se o jogo de ontem NÃO terminou e HOJE NÃO está protegido, bane não-participantes (respeitando imunidade de adicionados no meio do jogo)
        if (wasGameActiveYesterday && !isTodayProtected) {
            const unplayedNonAdmins = [];
            const addedUsersTimestamps = state.addedUsersTimestamps || {};
            for (const p of chat.participants) {
                const pRaw = extractRawNumber(p.id?._serialized);
                const pLidRaw = p.lid ? extractRawNumber(p.lid._serialized) : null;
                const isAdminByConfig = (pRaw && ADMIN_NUMBERS.has(pRaw)) || (pLidRaw && ADMIN_NUMBERS.has(pLidRaw));
                const isAdmin = p.isAdmin || p.isSuperAdmin || isAdminByConfig;
                const isBot = botId && (p.id?._serialized === botId || extractRawNumber(p.id?._serialized) === extractRawNumber(botId));
                if (!isAdmin && !isBot && !isUserPlayed(p, playedUserIds, addedMidGameUsers, addedUsersTimestamps)) {
                    unplayedNonAdmins.push(p.id._serialized);
                }
            }

            if (unplayedNonAdmins.length > 0) {
                console.log(`[Xuxa Game] Reset 12:00. Banindo ${unplayedNonAdmins.length} membro(s) nao participantes do dia anterior...`);
                try {
                    await chat.removeParticipants(unplayedNonAdmins);

                    const currentLetter = state.currentLetter || '?';
                    const mentions = unplayedNonAdmins.map(id => `@${extractRawNumber(id)}`).join(', ');
                    const banMsg = `${mentions} foram removidos por nao participarem da rodada de ontem.\n\nAinda é a letra ${currentLetter}`;
                    await chat.sendMessage(banMsg);
                } catch (err) {
                    console.error("Erro ao banir nao participantes no reset 12:00:", err.message);
                }
            }
        } else {
            console.log("[Xuxa Game] Reset das 12:00 sem banimentos (jogo concluído, sem jogadas ou proteção temporária ativa).");
        }

        // Verifica se sobrou apenas 1 não-admin
        if (await checkLastSurvivor(chat, client)) {
            state.lastResetDate = todayStr;
            state.gameCompletedToday = true;
            state.gameStarted = false;
            saveGameState(state);
            return;
        }

        // Obtém membros não-admins atuais
        const currentNonAdmins = getNonAdminParticipants(chat, botId);

        // Se NÃO HOUVER membros não-admins (0 jogadores), não inicia o jogo
        if (currentNonAdmins.length === 0) {
            console.log("[Xuxa Game] Nenhum participante não-admin no grupo. Jogo em espera.");
            state.lastResetDate = todayStr;
            state.gameStarted = false;
            state.gameCompletedToday = true;
            saveGameState(state);
            await chat.sendMessage(`Nao ha participantes no grupo para iniciar o jogo. Aguardando novos jogadores.`);
            return;
        }

        // Decisão do novo Modo baseada no número de não-admins e dias consecutivos em AEIOU
        let mode = 'ABC_2';
        let newAeiouDaysCount = state.aeiouDaysCount || 0;

        if (currentNonAdmins.length > 27) {
            mode = 'ABC_1';
            newAeiouDaysCount = 0;
        } else if (currentNonAdmins.length >= 10) {
            mode = 'ABC_2';
            newAeiouDaysCount = 0;
        } else {
            // <= 9 participantes (Entra em AEIOU)
            newAeiouDaysCount += 1;
            if (newAeiouDaysCount <= 3) {
                mode = 'AEIOU_1';
            } else {
                mode = 'AEIOU_2';
            }
        }

        const alphabet = getAlphabetForMode(mode);
        const maxWords = getMaxWordsForMode(mode, { aeiouDaysCount: newAeiouDaysCount });

        // Sorteia novo tema e reseta para a nova rodada
        const newTheme = getRandomTheme(state.theme);
        const botWordA = await gerarPalavraParaLetraA(newTheme);
        const nextLetterAfterA = alphabet[1]; // 'E' no AEIOU, 'B' no ABC

        const newState = {
            mode: mode,
            aeiouDaysCount: newAeiouDaysCount,
            currentLetter: nextLetterAfterA,
            theme: newTheme,
            userCounts: {},
            addedMidGameUsers: [], // Reseta a lista de imunidade parcial para a nova rodada
            lastResetDate: todayStr,
            gameStarted: true,
            gameCompletedToday: false,
            disableBansToday: isTodayProtected ? (['2026-09-10', '2026-09-28'].includes(todayStr)) : false
        };
        saveGameState(newState);

        // 1ª Mensagem: Regras da fase
        await chat.sendMessage(buildRulesText(mode, maxWords, newAeiouDaysCount));

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
    // O reset diário ocorre ao meio-dia (12:00)
    if (now.getHours() < 12) {
        return;
    }

    const todayStr = getTodayDateString();
    const state = loadGameState();

    if (state.lastResetDate !== todayStr) {
        console.log(`[Xuxa Game] Executando reset diário automático das 12:00 para o dia ${todayStr} (último reset: ${state.lastResetDate || 'nunca'})...`);
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

        const botId = client?.info?.wid?._serialized;
        // SE A MENSAGEM FOI ENVIADA PELO PRÓPRIO BOT, IGNORA TOTALMENTE
        if (message.fromMe || (botId && (senderId === botId || extractRawNumber(senderId) === extractRawNumber(botId)))) {
            return false;
        }

        const state = loadGameState();

        // Se a rodada não começou ou o jogo já foi concluído hoje, ignora a mensagem (grupo livre)
        if (!state.gameStarted || state.gameCompletedToday) {
            return false;
        }

        const chat = await message.getChat();
        if (await checkLastSurvivor(chat, client)) {
            return true;
        }
        const mode = state.mode || 'ABC_2';
        const alphabet = getAlphabetForMode(mode);
        const maxWords = getMaxWordsForMode(mode, state);
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

        // 1. FORMATO INVÁLIDO OU CONVERSA NO GRUPO
        if (!match) {
            await banUser(chat, client, senderId, 'Conversou durante o jogo ou não usou o formato "X de Y".', message);
            return true;
        }

        const inputLetter = match[1].toUpperCase();
        const inputPhrase = match[2].trim();

        // 2. LIMITE DE PALAVRAS POR DIA PARA O MODO ATUAL
        const currentCount = state.userCounts[senderId] || 0;
        if (currentCount >= maxWords) {
            await banUser(chat, client, senderId, `Falou MAIS de ${maxWords} palavra(s) no mesmo dia/rodada (${mode}).`, message);
            return true;
        }

        // 3. LETRA FORA DA ORDEM
        if (inputLetter !== expectedLetter) {
            await banUser(chat, client, senderId, `Letra fora da ordem alfabética. Esperado: ${expectedLetter}, Enviado: ${inputLetter}.`, message);
            return true;
        }

        // 4. VALIDAÇÃO DA PALAVRA / TEMA COM IA
        const aprovado = await validarComIA(expectedLetter, inputPhrase, state.theme);
        if (!aprovado) {
            await banUser(chat, client, senderId, `Palavra "${inputPhrase}" recusada para o tema "${state.theme}".`, message);
            return true;
        }

        // REGISTRA A JOGADA DO USUÁRIO
        const idsToRegister = new Set();
        if (senderId) {
            idsToRegister.add(senderId);
            const rawSenderNum = extractRawNumber(senderId);
            if (rawSenderNum) idsToRegister.add(rawSenderNum);
        }

        try {
            const contact = await message.getContact();
            if (contact) {
                if (contact.id?._serialized) idsToRegister.add(contact.id._serialized);
                if (contact.id?.user) idsToRegister.add(contact.id.user);
                if (contact.number) idsToRegister.add(contact.number);
                if (contact.lid?._serialized) idsToRegister.add(contact.lid._serialized);
                if (contact.lid?.user) idsToRegister.add(contact.lid.user);
            }
        } catch (e) {
            // ignore contact fetch errors
        }

        for (const id of idsToRegister) {
            if (id) {
                state.userCounts[id] = (state.userCounts[id] || 0) + 1;
            }
        }

        const currentIndex = alphabet.indexOf(expectedLetter);
        const isLastLetter = (alphabet.includes('U') && alphabet.length === 5 && expectedLetter === 'U') ||
                             (expectedLetter === 'Z') ||
                             currentIndex === alphabet.length - 1;

        // SE CHEGOU NA ÚLTIMA LETRA (Z NO ABC OU U NO AEIOU)
        if (isLastLetter) {
            await message.reply(`*${inputLetter} de ${inputPhrase}* APROVADO!`);
            saveGameState(state);

            const todayStr = getTodayDateString();
            const isTodayProtected = ['2026-09-10', '2026-09-28'].includes(todayStr) || state.disableBansToday;

            // Audit de banimento silencioso de quem não jogou NENHUMA vez nesta rodada (se não for hoje protegido)
            if (!isTodayProtected) {
                const playedMap = state.userCounts || {};
                const addedMidGameUsers = state.addedMidGameUsers || [];
                const addedUsersTimestamps = state.addedUsersTimestamps || {};
                const unplayedNonAdmins = [];

                for (const p of chat.participants) {
                    const pRaw = extractRawNumber(p.id?._serialized);
                    const pLidRaw = p.lid ? extractRawNumber(p.lid._serialized) : null;
                    const isAdminByConfig = (pRaw && ADMIN_NUMBERS.has(pRaw)) || (pLidRaw && ADMIN_NUMBERS.has(pLidRaw));
                    const isAdmin = p.isAdmin || p.isSuperAdmin || isAdminByConfig;
                    const isBot = botId && (p.id?._serialized === botId || extractRawNumber(p.id?._serialized) === extractRawNumber(botId));

                    if (!isAdmin && !isBot && !isUserPlayed(p, playedMap, addedMidGameUsers, addedUsersTimestamps)) {
                        unplayedNonAdmins.push(p.id._serialized);
                    }
                }

                if (unplayedNonAdmins.length > 0) {
                    console.log(`[Xuxa Game] Rodada ${mode} concluida! Banindo ${unplayedNonAdmins.length} membro(s) nao participantes...`);
                    try {
                        await chat.removeParticipants(unplayedNonAdmins);

                        const mentions = unplayedNonAdmins.map(id => `@${extractRawNumber(id)}`).join(', ');
                        const banMsg = `${mentions} foram removidos por nao participarem da rodada de hoje.`;
                        await chat.sendMessage(banMsg);
                    } catch (err) {
                        console.error("Erro ao banir nao participantes no final da rodada:", err.message);
                    }
                }
            }

            // Verifica se sobrou apenas 1 não-admin
            await checkLastSurvivor(chat, client);

            // Marca o jogo como concluído hoje
            state.gameCompletedToday = true;
            state.gameStarted = false;
            saveGameState(state);

            await chat.sendMessage(`Conseguiram! O alfabeto foi concluido.\n\nAproveitem o tempo livre. Ate o proximo reset as 12:00 ninguem mais e banido.`);
            return true;
        }

        const nextLetter = alphabet[currentIndex + 1];
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
    executeDailyReset,
    registerJoinedUser,
    checkLastSurvivor
};
