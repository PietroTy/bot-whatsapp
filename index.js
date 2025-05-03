// PietroTy //
require('dotenv').config();

const { Client } = require('whatsapp-web.js');
const { MessageMedia } = require('whatsapp-web.js');

const qrcode = require('qrcode-terminal');
const axios = require('axios');
const sharp = require('sharp');

const chatHistory = {};

const client = new Client({
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot está ON!');
});

client.on('message', async (message) => {
    const text = message.body.toLowerCase();
    const groupName = "figurinhas#bot";

    if (text.length < 2) return;

    const chat = await message.getChat();
    const isStickerGroup = chat.isGroup && chat.name === groupName;

    if (isStickerGroup && text.trim() === "#link") {
        await message.reply("Aqui está o link do grupo:\nhttps://chat.whatsapp.com/KAg83JlOyWSGoHLBOLwrR8");
        return;
    }

    if (message.hasQuotedMsg && text.startsWith("#bot")) {
        const quotedMessage = await message.getQuotedMessage();

        if (isStickerGroup) {
            if (quotedMessage.hasMedia && quotedMessage.type === 'image') {
                const media = await quotedMessage.downloadMedia();

                if (!media || !media.mimetype.startsWith("image")) {
                    await message.reply("Isso não parece ser uma imagem compatível.");
                    return;
                }

                const buffer = Buffer.from(media.data, 'base64');

                const webpBuffer = await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp()
                    .toBuffer();

                const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));

                await client.sendMessage(message.from, stickerMedia, {
                    sendMediaAsSticker: true,
                    stickerName: '',
                    stickerAuthor: ''
                });
            } else {
                await message.reply("Neste grupo, apenas comandos de criação de figurinhas com imagens são permitidos.");
            }
            return;
        }

        try {
            const media = await quotedMessage.downloadMedia();

            if (quotedMessage.hasMedia && quotedMessage.type === 'image') {
                if (!media || !media.mimetype.startsWith("image")) {
                    await message.reply("Isso não parece ser uma imagem compatível.");
                    return;
                }

                const buffer = Buffer.from(media.data, 'base64');

                const webpBuffer = await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp()
                    .toBuffer();

                const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));

                await client.sendMessage(message.from, stickerMedia, {
                    sendMediaAsSticker: true,
                    stickerName: '',
                    stickerAuthor: ''
                });
            } else {
                const userId = message.from;

                if (!chatHistory[userId]) {
                    chatHistory[userId] = [getSystemPrompt()];
                }

                const contextMessage = quotedMessage.body || "Mensagem sem texto.";
                chatHistory[userId].push({ role: "user", content: `Mensagem original: "${contextMessage}"\nResposta: "${text}"` });

                const resposta = await perguntarIA(chatHistory[userId]);

                chatHistory[userId].push({ role: "assistant", content: resposta });

                if (chatHistory[userId].length > 20) {
                    chatHistory[userId] = chatHistory[userId].slice(-20);
                }

                await message.reply(resposta);
            }
        } catch (error) {
            console.error("Erro ao processar mensagem respondida:", error.message);
            await message.reply("Erro ao processar a mensagem respondida.");
        }
        return;
    }

    if (message.hasMedia && message.type === 'image' && message.body.trim() === '#bot') {
        try {
            const media = await message.downloadMedia();

            if (!media || !media.mimetype.startsWith("image")) {
                await message.reply("Isso não parece ser uma imagem compatível.");
                return;
            }

            const buffer = Buffer.from(media.data, 'base64');

            const webpBuffer = await sharp(buffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp()
                .toBuffer();

            const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));

            await client.sendMessage(message.from, stickerMedia, {
                sendMediaAsSticker: true,
                stickerName: '',
                stickerAuthor: ''
            });

        } catch (error) {
            console.error("Erro ao converter para figurinha:", error);
            await message.reply("Falha ao transformar a imagem em figurinha.");
        }
        return;
    }

    else if (text.startsWith("#bot")) {
        if (isStickerGroup) {
            await message.reply("Neste grupo, apenas comandos de criação de figurinhas são permitidos.");
            return;
        }

        try {
            const userId = message.from;

            if (!chatHistory[userId]) {
                chatHistory[userId] = [getSystemPrompt()];
            }

            chatHistory[userId].push({ role: "user", content: text });

            const resposta = await perguntarIA(chatHistory[userId]);

            chatHistory[userId].push({ role: "assistant", content: resposta });

            if (chatHistory[userId].length > 20) {
                chatHistory[userId] = chatHistory[userId].slice(-20);
            }

            await message.reply(resposta);
        } catch (error) {
            console.error("Erro com IA:", error.message);
            await message.reply("Erro ao responder com IA.");
        }
    }
});

function getSystemPrompt() {
    return {
        role: "system",
        content: `Você é um robô chamado "Bot". Responda de forma direta, objetiva e robótica, sem usar gírias, emojis ou linguagem informal, e de preferência em formato de tópicos.
        Sua função é auxiliar quando chamado com frases que iniciam com "#bot", realizando as seguintes tarefas:
        
        - Responder perguntas objetivas e gerais.
        - Gerar textos sob demanda (como resumos, descrições, frases e ideias).
        - Manter conversas contínuas com base no histórico.
        - Criar figurinhas: ao receber uma imagem com a legenda exatamente "#bot", você deve transformá-la em figurinha.
        - Informar da existência e mandar o link do grupo chamado "figurinhas#bot" quando solicitado: https://chat.whatsapp.com/KAg83JlOyWSGoHLBOLwrR8.
        - Responder perguntas sobre o servidor de Minecraft, como IP, seed e login.
        - Responder perguntas sobre o criador do bot, como nome e links relevantes.
        
        Adicionalmente, dependendo do contexto:
        
        - Informe suas funcionalidades de forma resumida quando questionado sobre elas.
        - Quando a conversa mencionar "Minecraft", "Pitcraft" ou similares, mencione o servidor de Minecraft de IP: pitcraft.duckdns.org:13377.
        - Quando perguntado, informe a seed do mapa: 7572138602753151096.
        - Instrua o usuário a digitar "/l opa" no chat ao entrar no servidor para realizar login.
        - Quando perguntado, informe que seu criador é Pietro Turci, estudante de Ciência da Computação no IFSP.
        - Quando questionado, forneça os seguintes links:
            - GitHub: https://github.com/PietroTy
            - Portfólio: https://pietroty.github.io/PietroTy/`
    };
}

async function perguntarIA(messages) {
    const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            model: "openai/gpt-3.5-turbo",
            messages: messages
        },
        {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.choices[0].message.content.trim();
}

client.initialize();

client.on('disconnected', (reason) => {
    console.log('Bot desconectado:', reason);
    client.initialize();
});

client.on('authenticated', (session) => {
    console.log('Bot autenticado!');
});