require('dotenv').config();

const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const chatHistory = {};
const chatWithNewsletter = ["T . D . A . P .", "Q Cremosidade"];

const client = new Client({
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', () => console.log('Bot está ON!'));

client.on('message', async (message) => {
    const text = message.body.toLowerCase();
    if (text.length < 2) return;

    if (text.startsWith('#news')) {
        try {
            const response = await axios.post('http://127.0.0.1:8000/noticias', {
                quantidade: 40,
                formato: "resumo"
            });
            const noticias = response.data.noticias_importantes;
            let mensagem = "";
            if (Array.isArray(noticias)) {
                mensagem = noticias.map((n, i) =>
                    `Notícia ${i+1}:\nTítulo: ${n.titulo}\nResumo: ${n.resumo}\nCategoria: ${n.categoria}`
                ).join('\n\n');
            } else {
                mensagem = noticias.toString();
            }
            await message.reply(`📰 Jornal do dia:\n\n${mensagem}`);
        } catch {
            await message.reply("Desculpe, não foi possível obter o jornal hoje.");
        }
        return;
    }

    const chat = await message.getChat();
    const isStickerGroup = chat.isGroup && chat.name === "figurinhas#bot";
    const contact = await message.getContact();
    const isFromNewsletter = contact.name === "Newsletter";

    if (isFromNewsletter) {
        try {
            const noticiasResp = await axios.post('http://127.0.0.1:8000/noticias', {
                quantidade: 200,
                formato: "resumo"
            });

            let noticias = noticiasResp.data.noticias_importantes;
            if (typeof noticias === "string") {
                try {
                    const parsed = JSON.parse(noticias.replace(/```json|```/g, ""));
                    noticias = parsed.noticias_importantes || [];
                } catch {
                    noticias = [];
                }
            }

            let jogosGratisEpic = noticiasResp.data.jogos_gratis_epic || [];
            if (typeof jogosGratisEpic === "string") {
                try {
                    jogosGratisEpic = JSON.parse(jogosGratisEpic);
                } catch {
                    jogosGratisEpic = [];
                }
            }

            let noticiasTexto = "";
            if (Array.isArray(noticias)) {
                noticiasTexto = noticias.map((n, i) =>
                    `Notícia ${i+1}: ${n.titulo} - ${n.resumo} [${n.categoria}]`
                ).join('\n');
            } else {
                noticiasTexto = noticias.toString();
            }

            function extrairTopoVinimunews(texto) {
                const limite = 2000;
                const regex = /(\*🪐 HORÓSCOPO DO DIA[\s\S]+?)(\*|$)/i;
                const match = texto.match(regex);
                if (match) {
                    return texto.slice(0, texto.indexOf(match[0]) + match[0].length);
                }
                return texto.slice(0, limite);
            }
            const vinimunewsTopo = extrairTopoVinimunews(message.body);

            const editionNumber = incrementEditionNumber();

            let jogosEpicTexto = "";
            if (Array.isArray(jogosGratisEpic) && jogosGratisEpic.length > 0) {
                jogosEpicTexto = jogosGratisEpic.map(j =>
                    `🎮 ${j.titulo} (${j.loja})`
                ).join('\n');
            }

            const prompt = `
Você é um assistente de redação de jornal automatizado.

Monte um jornal diário no formato abaixo, seguindo estas regras:
- O cabeçalho deve ser exatamente assim (exceto a data, que deve ser extraída do texto do editor VINIMUNEWS):
📰 PITMUNEWS – Ano 1, Nº ${editionNumber} 🗞  
📍 De SJBV-SP / SP-SP  
📅 <DATA extraída do texto do editor VINIMUNEWS>  

---
- As seções "Dia do ano", "Lua", "HOJE É DIA DE...", "Tempo em São Paulo/SP" e "Horóscopo" devem ser retiradas e resumidas do texto do editor VINIMUNEWS abaixo. O horóscopo deve ser resumido, sem cor ou números.
- Das 200 notícias fornecidas, escolha as 40 mais relevantes e use apenas essas nos DESTAQUES DO DIA.
- Cada notícia deve começar com um emoji relevante ao tema da notícia.
- As notícias da seção "DESTAQUES DO DIA" devem ser retiradas **exclusivamente** da lista de notícias fornecida (não use o texto do editor para as notícias).
- Se não houver texto do editor VINIMUNEWS (ou seja, se o campo abaixo estiver vazio ou ausente), não gere o jornal e apenas responda com: erro no jornal.
- Ao final do jornal, adicione uma seção chamada "🎁 JOGOS GRÁTIS DO DIA" e escreva "Consulte a Epic Games Store e outras plataformas para jogos grátis do dia."
- Na seção DESTAQUES DO DIA, a categoria **GAMES** deve ser a primeira, antes de POLÍTICA, e deve começar com as informações de jogos grátis da Epic Games Store (se houver), seguidas das notícias de games.
- Para os jogos grátis da Epic Games, liste-os no topo da seção GAMES, um por linha, no formato: 🎮 Título (Grátis na Epic Games)
- Mantenha o restante do formato igual ao exemplo, adaptando apenas o conteúdo conforme as regras acima.

---EXEMPLO DE FORMATO---
📰 PITMUNEWS – Ano 1, Nº ${editionNumber} 🗞  
📍 De SJBV-SP / SP-SP  
📅 Segunda-feira, 16 de Junho de 2025  

---

⏳ Dia 167 do ano  
🌕 Lua Cheia – 73,07% visível  

---

📆 *HOJE É DIA DE...*  
🌍 Criança Africana  
🍆 Legumes Frescos  
🔸 Leopold Bloom  
⚔ Levante de Soweto  
💸 Remessas Familiares  
🐢 Tartaruga Marinha  
🇧🇷 Unidade Nacional  

---

☀ *TEMPO EM SÃO PAULO/SP*  
🌤 Sol com algumas nuvens à tarde  
🌫 Nevoeiro à noite  
🌡 Mín: 12°C | Máx: 25°C  

---

💫 *HORÓSCOPO – GÊMEOS ♊*  
Comece a semana cheio de energia para parcerias e novos projetos.  
Mas cuidado com o excesso de confiança à tarde!  
Paquera favorecida pela entrada da Lua em Peixes.  

---

📰 *DESTAQUES DO DIA*:

📌 **GAMES**  
${jogosEpicTexto}
- ...notícias de games da API, cada uma começando com um emoji...

📌 **POLÍTICA**  
- ...notícias da API, cada uma começando com um emoji...

📌 **TECNOLOGIA**  
- ...notícias da API, cada uma começando com um emoji...

📌 **SAÚDE & MEIO AMBIENTE**  
- ...notícias da API, cada uma começando com um emoji...

---

📨 Você está lendo **PITMUNEWS**  
🧠 Criado com: TogetherAI, VINIMUNEWS e News API  
🤖 Distribuído automaticamente pelo Botzin do ZipZop  

---FIM DO JJORNAL---

Texto do editor (VINIMUNEWS) - use apenas o necessário para as seções do topo:
${vinimunewsTopo}

Notícias do dia (use apenas estas para os DESTAQUES DO DIA, escolha as 40 melhores):
${noticiasTexto}

Jogos grátis da Epic Games Store (adicione no topo da seção GAMES, se houver):
${jogosEpicTexto}

Gere o jornal do dia, mesclando as informações, no mesmo formato do exemplo acima, seguindo todas as regras.
`;

            const jornal = await perguntarIA([
                { role: "system", content: "Você é um assistente de redação de jornal automatizado." },
                { role: "user", content: prompt }
            ]);

            const allChats = await client.getChats();
            const targetGroups = allChats.filter(chat =>
                chat.isGroup && chatWithNewsletter.includes(chat.name)
            );

            if (targetGroups.length > 0) {
                for (const group of targetGroups) {
                    await client.sendMessage(group.id._serialized, jornal);

                    const stickerPath = path.join(__dirname, 'Newsletter.webp');
                    if (fs.existsSync(stickerPath)) {
                        const stickerBuffer = fs.readFileSync(stickerPath);
                        const stickerMedia = new MessageMedia('image/webp', stickerBuffer.toString('base64'));
                        await client.sendMessage(group.id._serialized, stickerMedia, {
                            sendMediaAsSticker: true,
                            stickerName: '',
                            stickerAuthor: ''
                        });
                    }
                }
            } else {
                await message.reply("Grupo não encontrado.");
            }
        } catch {
            await message.reply("Ocorreu um erro ao tentar gerar ou enviar o jornal.");
        }
        return;
    }

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
        } catch {
            await message.reply("Erro ao processar a mensagem respondida.");
        }
        return;
    }

    if (message.hasMedia && message.body.trim() === '#bot') {
        try {
            const media = await message.downloadMedia();
            if (!media) {
                await message.reply("Erro ao baixar a mídia.");
                return;
            }
            const buffer = Buffer.from(media.data, 'base64');
            const mime = media.mimetype;
            const tempInputPath = path.join(__dirname, `temp_input.${mime.includes("video") ? 'mp4' : 'png'}`);
            const tempOutputPath = path.join(__dirname, 'temp_output.webp');
            fs.writeFileSync(tempInputPath, buffer);

            if (mime.includes("image")) {
                await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp()
                    .toFile(tempOutputPath);
            } else if (mime.includes("video")) {
                await new Promise((resolve, reject) => {
                    const cmd = `ffmpeg -i "${tempInputPath}" -vf "fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -c:v libwebp -lossless 0 -qscale 75 -preset default -an -t 6 -loop 0 -y "${tempOutputPath}"`;
                    exec(cmd, (err) => {
                        if (err) reject();
                        else resolve();
                    });
                });
            } else {
                await message.reply("A mídia deve ser uma imagem ou vídeo curto.");
                return;
            }

            const webpBuffer = fs.readFileSync(tempOutputPath);
            const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));
            await client.sendMessage(message.from, stickerMedia, {
                sendMediaAsSticker: true,
                stickerName: '',
                stickerAuthor: ''
            });

            fs.unlinkSync(tempInputPath);
            fs.unlinkSync(tempOutputPath);
        } catch {
            await message.reply("Falha ao transformar a mídia em figurinha.");
        }
        return;
    }

    if (text.startsWith("#bot")) {
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
        } catch {
            await message.reply("Erro ao responder com IA.");
        }
    }
});

const COUNTER_FILE = path.join(__dirname, 'pitmunews_counter.json');

function getEditionNumber() {
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
            return data.edition || 1;
        }
    } catch {}
    return 1;
}

function incrementEditionNumber() {
    let edition = getEditionNumber() + 1;
    try {
        fs.writeFileSync(COUNTER_FILE, JSON.stringify({ edition }), 'utf8');
    } catch {}
    return edition;
}

function getSystemPrompt() {
    return {
        role: "system",
        content: `Você é um robô chamado "Bot". Responda de forma direta, objetiva e robótica, sem usar gírias, emojis ou linguagem informal.
        Sua função é auxiliar quando chamado com frases que iniciam com "#bot", realizando as seguintes tarefas:
        - Responder perguntas objetivas e gerais.
        - Gerar textos sob demanda (como resumos, descrições, frases e ideias).
        - Manter conversas contínuas com base no histórico.
        - Criar figurinhas: ao receber uma imagem, vídeo curto ou gif com a legenda exatamente "#bot", você deve transformá-la em figurinha.
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

async function perguntarIA(messages) {
    const apiKey = process.env.TOGETHER_API_KEY;
    const payload = {
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
    };
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    const response = await axios.post(
        "https://api.together.xyz/v1/chat/completions",
        payload,
        { headers }
    );
    return response.data.choices[0].message.content.trim();
}

client.initialize();

client.on('disconnected', (reason) => {
    console.log('Bot desconectado:', reason);
    client.initialize();
});

client.on('authenticated', () => {
    console.log('Bot autenticado!');
});