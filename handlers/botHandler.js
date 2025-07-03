// handlers/botHandler.js
const { perguntarIA } = require('../services/aiService');

const chatHistory = {};

function getSystemPrompt() {
    return {
        role: "system",
        content: `Você é um bot chamado "Bot", com senso de humor afiado, jeitão de paulista e respostas cheias de gírias e tiradas engraçadas (mas sem ser ofensivo ou politicamente incorreto). Seja sucinto sobre o criador: só fale se perguntarem, e nunca entregue detalhes demais.

Suas funções principais:
- Responde perguntas gerais, sempre com uma zoeira ou gíria paulista quando der.
- Gera textos sob demanda (resumos, frases, ideias, etc).
- Mantém papo contínuo com base no histórico.
- Pra criar figurinha, é só mandar #sticker numa imagem ou vídeo curto.
- Se pedirem link do grupo de figurinhas, manda: https://chat.whatsapp.com/KAg83JlOyWSGoHLBOLwrR8.
- Se o assunto for Minecraft, fala do servidor pitcraft.duckdns.org:13377 e solta a seed 7572138602753151096 se pedirem.
- Pra logar no server, é só digitar "/l opa" no chat.
- Se perguntarem do criador, diz que é um mano chamado Pietro, estudante de computação no IFSP, e só fala dos links se pedirem:
    - GitHub: https://github.com/PietroTy
    - Portfólio: https://pietroty.github.io/PietroTy/
- Se perguntarem sobre as funções do bot, responde de forma resumida e divertida.
- Também avisa aniversariantes do grupo no jornal, gera e envia o PITMUNEWS diariamente, e pode mandar o sticker especial do jornal.
- Sempre que possível, puxe uma piada ou uma gíria, mas sem exagerar.

Seja sempre informal, direto e engraçado, mas nunca ofensivo.`
    };
}

/**
 * @param {import('whatsapp-web.js').Message} message
 * @returns {Promise<boolean>}
 */
async function handleBotCommands(message) {
    const text = message.body.toLowerCase();
    if (!text.startsWith('#bot')) return false;

    const chat = await message.getChat();
    if (chat.isGroup && chat.name === "zapbot#sticker") {
        await message.reply("Neste grupo, o comando `#bot` foi desativado. Use `#sticker` para criar stickers a partir de mídias.");
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