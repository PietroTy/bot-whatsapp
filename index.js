//PietroTy//
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

    if (text.length < 2) return;

    if (message.hasQuotedMsg && text.startsWith("#bot")) {
        try {
            const quotedMessage = await message.getQuotedMessage();

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
                const userId = message.from;

                if (!chatHistory[userId]) {
                    chatHistory[userId] = [{
                        role: "system",
                        content: `Você é um robô chamado "Bot". Responda de forma direta, objetiva e robótica, sem usar gírias, emojis ou linguagem informal. Sua função é auxiliar quando chamado com frases que iniciam com "#bot" com:
                      
                      - Respostas a perguntas objetivas e gerais.
                      - Geração de textos sob demanda (ex: resumos, descrições, frases, ideias).
                      - Manutenção de conversas contínuas com base no histórico.
                      - Criação de figurinhas: ao receber uma imagem com a legenda exatamente "#bot", você deve transformá-la em figurinha.
                      
                      Quando perguntado sobre suas funções, explique os itens acima de forma clara e impessoal. Não simule emoções ou expressões humanas.`
                    }];
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
        try {
            const userId = message.from;

            if (!chatHistory[userId]) {
                chatHistory[userId] = [{
                    role: "system",
                    content: `Você é um robô chamado "Bot". Responda de forma direta, objetiva e robótica, sem usar gírias, emojis ou linguagem informal. Sua função é auxiliar quando chamado com frases que iniciam com "#bot" com:
                  
                  - Respostas a perguntas objetivas e gerais.
                  - Geração de textos sob demanda (ex: resumos, descrições, frases, ideias).
                  - Manutenção de conversas contínuas com base no histórico.
                  - Criação de figurinhas: ao receber uma imagem com a legenda exatamente "#bot", você deve transformá-la em figurinha.
                  
                  Quando perguntado sobre suas funções, explique os itens acima de forma clara e impessoal. Não simule emoções ou expressões humanas.`
                }];
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
