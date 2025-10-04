// handlers/termoHandler.js
const fs = require('fs');

const MAX_ATTEMPTS = 6;
const MAX_ATTEMPTS_DUETO = 7;
const MAX_ATTEMPTS_QUARTETO = 9;
const MAX_ATTEMPTS_OCTETO = 13;

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
        octeto: false
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
        octeto: false
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
        octeto: false
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
        octeto: true
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
    const termoCommands = ['#termo', '#dueto', '#quarteto', '#octeto', '#exit'];

    if (isStickerGroup && !termoCommands.includes(text)) {
        return false;
    }

    if (isStickerGroup) {
        await message.reply("Neste grupo, os comandos de jogos estão desativados. Use #sticker para criar stickers.");
        return true;
    }

    if (text === '#termo') {
        startTermo(chatId);
        termoGames[chatId].acertadas = [false];
        await message.reply(
            "🎮 *Termo iniciado!* Tente adivinhar a palavra de 5 letras.\n" +
            `Você tem ${MAX_ATTEMPTS} tentativas!`
        );
        return true;
    }

    if (text === '#dueto') {
        startDueto(chatId);
        termoGames[chatId].acertadas = [false, false];
        await message.reply(
            "🎮 *Dueto iniciado!* Tente adivinhar as 2 palavra de 5 letras.\n" +
            `Você tem ${MAX_ATTEMPTS_DUETO} tentativas!`
        );
        return true;
    }

    if (text === '#quarteto') {
        startQuarteto(chatId);
        termoGames[chatId].acertadas = [false, false, false, false];
        await message.reply(
            "🎮 *Quarteto iniciado!* Tente adivinhar as 4 palavra de 5 letras.\n" +
            `Você tem ${MAX_ATTEMPTS_QUARTETO} tentativas!`
        );
        return true;
    }

    if (text === '#octeto') {
        startOcteto(chatId);
        termoGames[chatId].acertadas = [false, false, false, false, false, false, false, false];
        await message.reply(
            "🎮 *Octeto iniciado!* Tente adivinhar as 8 palavras de 5 letras.\nBoa sorte mané kkkkkkkk\n" +
            `Você tem ${MAX_ATTEMPTS_OCTETO} tentativas!`
        );
        return true;
    }

    if (text === '#exit') {
        const game = termoGames[chatId];
        if (game && !game.finished) {
            game.finished = true;
            await message.reply(
                `Jogo encerrado!\nAs palavras eram: *${Array.isArray(game.secret) ? game.secret.map(w => w.toUpperCase()).join('*, *') : game.secret.toUpperCase()}*`
            );
        }
        return true;
    }

    const game = termoGames[chatId];
    if (!game || game.finished) return false;

    if (!/^[a-zçãõáéíóúâêô]{5}$/i.test(textOriginal)) return false;
    const guess = removeAcentos(textOriginal);

    if (!validWords.includes(guess)) {
        await message.reply("❌ Palavra inválida! Tente uma palavra de 5 letras que exista.");
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

    let replyMsg = `${display}\nTentativa ${game.attempts.length}/${tentativasMax}`;

    if (allAcertadas) {
        replyMsg += `\nParabéns! Você acertou todas as palavras *${secretsArr.map(w => w.toUpperCase()).join('*, *')}* em ${game.attempts.length} tentativa(s)!`;
        game.finished = true;
    } else if (game.attempts.length >= tentativasMax) {
        replyMsg += `\nBurro! As palavras eram *${secretsArr.map(w => w.toUpperCase()).join('*, *')}*.`;
        game.finished = true;
    }

    await message.reply(replyMsg);
    return true;
}

module.exports = { handleTermoCommands };