// handlers/botHandler.js
const { perguntarIA } = require('../services/aiService');

const chatHistory = {};

function getSystemPrompt() {
    return {
        role: "system",
        content: `Você é um bot chamado "Bot". Sua personalidade é sempre informal, direta e engraçada.

Seja sucinto, só fale se perguntarem, e nunca entregue detalhes demais.

- Sua função é ajudar, responder perguntas e criar textos sob demanda do usuário.
- Se quiserem saber os comandos do bot fale para darem o comando #help, que mostra a lista completa de todos os comandos.
- Se perguntarem, o nome do criador é Pietro, um estudante de computação do Instituto Federal e é dev.
- Ele curte tecnologia, de IA até bots, e é fluente em ingles.
- Se quiserem ver os projetos dele, os links são:
    - GitHub: https://github.com/PietroTy
    - Portfólio: https://pietroty.github.io/PietroTy/
- Servidor de Minecraft:
    - Se o assunto for Minecraft, fala do ip do servidor \`pitcraft.duckdns.org:13377\`.
    - A seed é \`7572138602753151096\`.
    - Pra logar no server, é só digitar \`/l opa\` no chat do jogo ao entrar.
`
    };
}

const comandos = [
    { cmd: "`#help`", desc: "Mostra esta lista de comandos disponíveis." },
    { cmd: "`#bot <mensagem>`", desc: "Converse com o Bot." },
    { cmd: "`#sticker`", desc: "Cria um sticker a partir de uma imagem, gif ou vídeo curto." },
    { cmd: "`#link`", desc: "Fornece o link de convite ao grupo de figurinhas do whatsapp." },
    { cmd: "`#termo`", desc: "Inicia uma partida de termo tradicional." },
    { cmd: "`#dueto`", desc: "Inicia uma partida de termo com 2 palavras simultâneas." },
    { cmd: "`#quarteto`", desc: "Inicia uma partida de termo com 4 palavras simultâneas." },
    { cmd: "`#octeto`", desc: "Inicia uma partida de termo com 8 palavras simultâneas." },
    { cmd: "`#16teto`", desc: "Inicia uma partida de termo com 16 palavras simultâneas." },
    { cmd: "`#exit`", desc: "Termina a partida ativa no momento." }
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
        await message.reply("Neste grupo, o comando `#bot` foi desativado. Use `#sticker` para criar stickers a partir de mídias.");
        return true;
    }

    if (text === '#help') {
        let lista = "*Comandos disponíveis:*\n";
        comandos.forEach(c => {
            lista += `${c.cmd}  →  ${c.desc}\n`;
        });
        await message.reply(lista);
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

        await message.reply(resposta);

    } catch (error) {
        console.error("Erro no handleBotCommands:", error);
        await message.reply("Desculpe, ocorreu um erro ao processar sua solicitação com a IA.");
    }

    return true;
}

module.exports = { handleBotCommands };