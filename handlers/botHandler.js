// handlers/botHandler.js
const { perguntarIA } = require('../services/aiService');
const { getSystemPrompt } = require('../config/systemPrompt');
const { version } = require('../package.json');

const chatHistory = {};

const comandos = [
    { cmd: "`#help`",              desc: "Mostra esta lista de comandos disponíveis." },
    { cmd: "`#bot <mensagem>`",    desc: "Converse com o Bot." },
    { cmd: "`#sticker`",           desc: "Cria um sticker a partir de uma imagem, gif ou vídeo curto." },
    { cmd: "`#link`",              desc: "Fornece o link de convite ao grupo de figurinhas do whatsapp." },
    { cmd: "`#termo`",             desc: "Inicia uma partida de termo tradicional." },
    { cmd: "`#dueto`",             desc: "Inicia uma partida de termo com 2 palavras simultâneas." },
    { cmd: "`#quarteto`",          desc: "Inicia uma partida de termo com 4 palavras simultâneas." },
    { cmd: "`#octeto`",            desc: "Inicia uma partida de termo com 8 palavras simultâneas." },
    { cmd: "`#16teto`",            desc: "Inicia uma partida de termo com 16 palavras simultâneas." },
    { cmd: "`#exit`",              desc: "Termina a partida ativa no momento." }
];

/**
 * @param {import('whatsapp-web.js').Message} message
 * @returns {Promise<boolean>}
 */
async function handleBotCommands(message) {
    const text = message.body.toLowerCase();
    if (!text.startsWith('#bot') && text !== '#help') return false;

    const chat = await message.getChat();

    if (chat.isGroup && chat.name === "zapbot#sticker" && text.startsWith('#bot')) {
        await chat.sendMessage("Neste grupo, o comando `#bot` foi desativado. Use `#sticker` para criar stickers a partir de mídias.", { quotedMessageId: message.id._serialized });
        return true;
    }

    if (text === '#help') {
        let lista = `🤖 *ZapBot v${version}*\n\n*Comandos disponíveis:*\n`;
        comandos.forEach(c => { lista += `${c.cmd}  →  ${c.desc}\n`; });
        await chat.sendMessage(lista, { quotedMessageId: message.id._serialized });
        return true;
    }

    try {
        const userId = message.from;

        if (!chatHistory[userId]) {
            chatHistory[userId] = [getSystemPrompt()];
        }

        let userContent = text;

        if (message.hasQuotedMsg) {
            const quotedMessage = await message.getQuotedMessage();
            if (quotedMessage.hasMedia) return false;
            const contextMessage = quotedMessage.body || "Mensagem sem texto.";
            userContent = `Considerando a mensagem anterior: "${contextMessage}"\n\nResponda a isto: "${text}"`;
        }

        chatHistory[userId].push({ role: "user", content: userContent });

        const resposta = await perguntarIA(chatHistory[userId]);

        chatHistory[userId].push({ role: "assistant", content: resposta });

        if (chatHistory[userId].length > 20) {
            chatHistory[userId] = [getSystemPrompt(), ...chatHistory[userId].slice(-19)];
        }

        await chat.sendMessage(resposta, { quotedMessageId: message.id._serialized });
    } catch (error) {
        console.error("Erro no handleBotCommands:", error);
        await chat.sendMessage("Desculpe, ocorreu um erro ao processar sua solicitação com a IA.", { quotedMessageId: message.id._serialized });
    }

    return true;
}

module.exports = { handleBotCommands };