// handlers/termoHandler.js
const fs = require('fs');

const MAX_ATTEMPTS = 6;
const MAX_ATTEMPTS_DUETO = 7;
const MAX_ATTEMPTS_QUARTETO = 9;
const MAX_ATTEMPTS_OCTETO = 13;
const MAX_ATTEMPTS_16TETO = 21;

const termoGames = {};

const termoWords = fs.readFileSync(__dirname + '/assets/termoWords.txt', 'utf-8')
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length === 5);

const validWords = fs.readFileSync(__dirname + '/assets/termoValid.txt', 'utf-8')
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length === 5);

function startTermo(chatId) {
    const secret = termoWords[Math.floor(Math.random() * termoWords.length)];
    termoGames[chatId] = {
        secret,
        attempts: [],
        finished: false,
        dueto: false,
        quarteto: false,
        octeto: false,
        desesseisteto:false
    };
    return secret;
}

function startDueto(chatId) {
    const secret1 = termoWords[Math.floor(Math.random() * termoWords.length)];
    let secret2;
    do {
        secret2 = termoWords[Math.floor(Math.random() * termoWords.length)];
    } while (secret2 === secret1);

    termoGames[chatId] = {
        secret: [secret1, secret2],
        attempts: [],
        finished: false,
        dueto: true,
        quarteto: false,
        octeto: false,
        desesseisteto:false
    };
    return [secret1, secret2];
}

function startQuarteto(chatId) {
    let secrets = [];
    while (secrets.length < 4) {
        const candidate = termoWords[Math.floor(Math.random() * termoWords.length)];
        if (!secrets.includes(candidate)) secrets.push(candidate);
    }
    termoGames[chatId] = {
        secret: secrets,
        attempts: [],
        finished: false,
        dueto: false,
        quarteto: true,
        octeto: false,
        desesseisteto:false
    };
    return secrets;
}

function startOcteto(chatId) {
    let secrets = [];
    while (secrets.length < 8) {
        const candidate = termoWords[Math.floor(Math.random() * termoWords.length)];
        if (!secrets.includes(candidate)) secrets.push(candidate);
    }
    termoGames[chatId] = {
        secret: secrets,
        attempts: [],
        finished: false,
        dueto: false,
        quarteto: false,
        octeto: true,
        desesseisteto:false
    };
    return secrets;
}

function start16teto(chatId) {
    let secrets = [];
    while (secrets.length < 16) {
        const candidate = termoWords[Math.floor(Math.random() * termoWords.length)];
        if (!secrets.includes(candidate)) secrets.push(candidate);
    }
    termoGames[chatId] = {
        secret: secrets,
        attempts: [],
        finished: false,
        dueto: false,
        quarteto: false,
        octeto: false,
        desesseisteto: true
    };
    return secrets;
}

const CORRECT_LETTERS = {
    a: '🅐', b: '🅑', c: '🅒', d: '🅓', e: '🅔', f: '🅕', g: '🅖', h: '🅗', i: '🅘', j: '🅙',
    k: '🅚', l: '🅛', m: '🅜', n: '🅝', o: '🅞', p: '🅟', q: '🅠', r: '🅡', s: '🅢', t: '🅣',
    u: '🅤', v: '🅥', w: '🅦', x: '🅧', y: '🅨', z: '🅩'
};
const PRESENT_LETTERS = {
    a: 'Ⓐ', b: 'Ⓑ', c: 'Ⓒ', d: 'Ⓓ', e: 'Ⓔ', f: 'Ⓕ', g: 'Ⓖ', h: 'Ⓗ', i: 'Ⓘ', j: 'Ⓙ',
    k: 'Ⓚ', l: 'Ⓛ', m: 'ⓜ', n: 'Ⓝ', o: 'Ⓞ', p: 'Ⓟ', q: 'Ⓠ', r: 'Ⓡ', s: 'Ⓢ', t: 'Ⓣ',
    u: 'Ⓤ', v: 'Ⓥ', w: 'Ⓦ', x: 'Ⓧ', y: 'Ⓨ', z: 'Ⓩ'
};
const ABSENT_LETTER = '◯';

function termoFeedback(secret, guess) {
    const secretArr = secret.split('');
    const guessArr = guess.split('');
    const feedback = Array(5).fill(ABSENT_LETTER);
    const secretUsed = Array(5).fill(false);

    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === secretArr[i]) {
            feedback[i] = CORRECT_LETTERS[guessArr[i]] || guessArr[i];
            secretUsed[i] = true;
        }
    }

    for (let i = 0; i < 5; i++) {
        if (feedback[i] !== ABSENT_LETTER) continue;
        for (let j = 0; j < 5; j++) {
            if (!secretUsed[j] && guessArr[i] === secretArr[j]) {
                feedback[i] = PRESENT_LETTERS[guessArr[i]] || guessArr[i];
                secretUsed[j] = true;
                break;
            }
        }
    }

    return feedback.join('');
}

function termoDisplay(feedbacks, guesses, secrets, acertadas) {
    let lines = [];
    for (let i = 0; i < feedbacks.length; i++) {
        if (acertadas[i]) {
            const word = secrets[i].toLowerCase();
            let line = '';
            for (const letter of word) {
                line += CORRECT_LETTERS[letter] || letter;
            }
            lines.push(line);
        } else {
            lines.push(feedbacks[i]);
        }
    }
    return lines.join('\n');
}

const removeAcentos = (str) => str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

async function handleTermoCommands(message, client) {
    const textOriginal = message.body.trim();
    const text = removeAcentos(textOriginal);

    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    const isStickerGroup = chat.isGroup && chat.name === "zapbot#sticker";
    const termoCommands = ['#termo', '#dueto', '#quarteto', '#octeto', "#16teto", '#exit'];

    if (isStickerGroup && !termoCommands.includes(text)) {
        return false;
    }

    if (isStickerGroup) {
        await chat.sendMessage("Neste grupo, os comandos de jogos estão desativados. Use `#sticker` para criar figurinhas.", { quotedMessageId: message.id._serialized });
        return true;
    }

    if (text === '#termo') {
        startTermo(chatId);
        termoGames[chatId].acertadas = [false];
        await chat.sendMessage(
            "🎮 *Termo iniciado!* Tente adivinhar a palavra de 5 letras.\n" +
            `Você tem ${MAX_ATTEMPTS} tentativas!`,
            { quotedMessageId: message.id._serialized }
        );
        return true;
    }

    if (text === '#dueto') {
        startDueto(chatId);
        termoGames[chatId].acertadas = [false, false];
        await chat.sendMessage(
            "🎮 *Dueto iniciado!* Tente adivinhar as 2 palavra de 5 letras.\n" +
            `Você tem ${MAX_ATTEMPTS_DUETO} tentativas!`,
            { quotedMessageId: message.id._serialized }
        );
        return true;
    }

    if (text === '#quarteto') {
        startQuarteto(chatId);
        termoGames[chatId].acertadas = [false, false, false, false];
        await chat.sendMessage(
            "🎮 *Quarteto iniciado!* Tente adivinhar as 4 palavra de 5 letras.\n" +
            `Você tem ${MAX_ATTEMPTS_QUARTETO} tentativas!`,
            { quotedMessageId: message.id._serialized }
        );
        return true;
    }

    if (text === '#octeto') {
        startOcteto(chatId);
        termoGames[chatId].acertadas = [false, false, false, false, false, false, false, false];
        await chat.sendMessage(
            "🎮 *Octeto iniciado!* Tente adivinhar as 8 palavras de 5 letras.\nBoa sorte mané kkkkkkkk\n" +
            `Você tem ${MAX_ATTEMPTS_OCTETO} tentativas!`,
            { quotedMessageId: message.id._serialized }
        );
        return true;
    }

    if (text === '#16teto') {
        start16teto(chatId);
        termoGames[chatId].acertadas = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
        await chat.sendMessage(
            "🎮 *16teto iniciado!* Tente adivinhar as 16 palavras de 5 letras.\nDeus te ajude.\n" +
            `Você tem ${MAX_ATTEMPTS_16TETO} tentativas!`,
            { quotedMessageId: message.id._serialized }
        );
        return true;
    }

    if (text === '#exit') {
        const game = termoGames[chatId];
        if (game && !game.finished) {
            game.finished = true;
            const secretsArr = Array.isArray(game.secret) ? game.secret : [game.secret];
            const finalWords = secretsArr.map(word => {
                let line = '';
                for (const letter of word.toLowerCase()) {
                    line += CORRECT_LETTERS[letter] || letter;
                }
                return line;
            }).join('\n');

            await chat.sendMessage(
                `Jogo encerrado!\nAs palavras eram:\n${finalWords}`,
                { quotedMessageId: message.id._serialized }
            );
        }
        return true;
    }

    const game = termoGames[chatId];
    if (!game || game.finished) return false;

    if (!/^[a-zçãõáéíóúâêô]{5}$/i.test(textOriginal)) return false;
    const guess = removeAcentos(textOriginal);

    if (!validWords.includes(guess)) {
        await chat.sendMessage("❌ Palavra inválida! Tente uma palavra de 5 letras que exista.", { quotedMessageId: message.id._serialized });
        return true;
    }

    game.attempts.push(guess);

    const feedbacks = [];
    let allAcertadas = true;
    const secretsArr = Array.isArray(game.secret) ? game.secret : [game.secret];
    for (let i = 0; i < secretsArr.length; i++) {
        if (game.acertadas[i]) {
            feedbacks.push(secretsArr[i]);
        } else if (guess === removeAcentos(secretsArr[i])) {
            game.acertadas[i] = true;
            feedbacks.push(secretsArr[i]);
        } else {
            feedbacks.push(termoFeedback(secretsArr[i], guess));
            allAcertadas = false;
        }
    }

    const display = termoDisplay(feedbacks, Array(secretsArr.length).fill(guess), secretsArr, game.acertadas);

    let tentativasMax = MAX_ATTEMPTS;
    if (game.dueto) tentativasMax = MAX_ATTEMPTS_DUETO;
    if (game.quarteto) tentativasMax = MAX_ATTEMPTS_QUARTETO;
    if (game.octeto) tentativasMax = MAX_ATTEMPTS_OCTETO;
    if (game.desesseisteto) tentativasMax = MAX_ATTEMPTS_16TETO;

    let replyMsg = `${display}\nTentativa ${game.attempts.length}/${tentativasMax}`;

    const finalWords = secretsArr.map(word => {
        let line = '';
        for (const letter of word.toLowerCase()) {
            line += CORRECT_LETTERS[letter] || letter;
        }
        return line;
    }).join('\n');

    if (allAcertadas) {
        replyMsg += `\n🎉 Parabéns! Você acertou todas as palavras em ${game.attempts.length} tentativa(s):\n${finalWords}`;
        game.finished = true;
    } else if (game.attempts.length >= tentativasMax) {
        replyMsg += `\n🫏 Burro! As palavras eram:\n${finalWords}`;
        game.finished = true;
    }

    await chat.sendMessage(replyMsg, { quotedMessageId: message.id._serialized });
    return true;
}

module.exports = { handleTermoCommands };