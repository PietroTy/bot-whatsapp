// handlers/botHandler.js
const { perguntarIA } = require('../services/aiService');

const chatHistory = {};

function getSystemPrompt() {
    return {
        role: "system",
        content: `Você é um robô chamado "Bot". Responda de forma direta, objetiva e robótica, sem usar gírias, emojis ou linguagem informal.
        Sua função é auxiliar quando chamado com frases que iniciam com "#bot", realizando as seguintes tarefas:
        - Responder perguntas objetivas e gerais.
        - Gerar textos sob demanda (como resumos, descrições, frases e ideias).
        - Manter conversas contínuas com base no histórico.
        - Para criar figurinhas, o usuário deve usar o comando #figurinha em uma imagem/vídeo.
        - Informar da existência e mandar o link do grupo chamado "figurinhas#bot" quando solicitado: https://chat.whatsapp.com/KAg83JlOyWSGoHLBOLwrR8.
        - Responder perguntas sobre o servidor de Minecraft, como IP, seed e login.
        - Responder perguntas sobre o criador do bot, como nome e links relevantes.
        Adicionalmente, dependendo do contexto:
        - Informe suas funcionalidades de forma resumida quando questionado sobre elas.
        - Quando a conversa mencionar "Minecraft", "Pitcraft" ou similares, mencione o servidor de Minecraft de IP: pitcraft.duckdns.org:13377.
        - Quando perguntado, informe a seed do mapa: 7572138602753151096.
        - Instrua o usuário a digitar "/l opa" no chat ao entrar no servidor para realizar login.
        - Quando perguntado, informe que seu criador é Pietro Turci, estudante de Ciência da Computação no IFSP.
        - Sempre que convêniente, ofereça e forneça os seguintes links:
            - GitHub: https://github.com/PietroTy
            - Portfólio: https://pietroty.github.io/PietroTy/`
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