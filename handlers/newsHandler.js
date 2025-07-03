// handlers/newsHandler.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { askAI } = require('../services/aiService');

const chatWithNewsletter = ["T . D . A . P .", "Laranja Cremosa"];
const newsletterCounterFile = path.join(__dirname, '../pitmunews_counter.json');

const birthdayList = [
    { name: 'Luiz', date: '27/01' },
    { name: 'Pedrin', date: '08/02' },
    { name: 'Liz', date: '09/02' },
    { name: 'Laila', date: '17/02' },
    { name: 'Dani', date: '03/03' },
    { name: 'Roger', date: '07/03' },
    { name: 'Xivana', date: '21/03' },
    { name: 'Mel', date: '13/04' },
    { name: 'Lidi', date: '21/05' },
    { name: 'Evelyn', date: '08/06' },
    { name: 'Nic', date: '08/06' },
    { name: 'Felipinho', date: '09/06' },
    { name: 'Xumas', date: '19/06' },
    { name: 'Mary', date: '21/06' },
    { name: 'Raissa', date: '26/06' },
    { name: 'Gregorio', date: '05/07' },
    { name: 'Bia', date: '13/07' },
    { name: 'Pietro', date: '01/09' },
    { name: 'Vito', date: '01/09' },
    { name: 'Kevin', date: '22/09' },
    { name: 'Layzer', date: '04/11' },
    { name: 'Rebs', date: '24/11' },
    { name: 'Casari', date: '17/12' },
    { name: 'Heitor', date: '17/12' },
    { name: 'Fernando', date: '16/12' },
    { name: 'SrQuirino', date: '19/12' },
    { name: 'Tirado', date: '26/12' },
    { name: 'Marcola', date: '28/12' },
    { name: 'Rogréio', date: '29/12' }
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getNewsletterEditionNumber() {
    try {
        if (fs.existsSync(newsletterCounterFile)) {
            const data = JSON.parse(fs.readFileSync(newsletterCounterFile, 'utf8'));
            return data.edition || 1;
        }
    } catch { }
    return 1;
}

function incrementNewsletterEditionNumber() {
    const currentEdition = getNewsletterEditionNumber();
    const newEdition = currentEdition + 1;
    try {
        fs.writeFileSync(newsletterCounterFile, JSON.stringify({ edition: newEdition }), 'utf8');
    } catch (error) {
        console.error("Erro ao salvar o contador do jornal:", error);
    }
    return newEdition;
}

async function fetchEpicFreeGames() {
    const url = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR";
    try {
        const response = await axios.get(url);
        const elements = response.data?.data?.Catalog?.searchStore?.elements || [];
        const freeGames = elements.filter(game =>
            game.price?.totalPrice?.discountPrice === 0 &&
            game.categories?.some(category => category.path === 'freegames')
        );
        return freeGames.map(game => game.title);
    } catch (error) {
        console.error("Erro ao buscar jogos grátis na Epic Games:", error.message);
        return [];
    }
}

function getBirthdayNames(newsText) {
    const regexDate = /(\d{1,2}) de (\w+) de (\d{4})/;
    const match = newsText.match(regexDate);
    if (!match) return [];

    const day = parseInt(match[1], 10);
    const monthText = match[2].toLowerCase();

    const months = { 'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12 };
    const month = months[monthText];
    if (!month) return [];

    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month).padStart(2, '0');
    const currentDate = `${formattedDay}/${formattedMonth}`;

    return birthdayList
        .filter(p => p.date === currentDate)
        .map(p => p.name);
}

function splitNewsletter(newsText) {
    const section1Start = '*🇧🇷 BRASIL GERAL*';
    const section2Start = '*💓 SAÚDE 💓*';

    const index1 = newsText.indexOf(section1Start);
    const index2 = newsText.indexOf(section2Start);

    if (index1 === -1 || index2 === -1) {
        return null;
    }

    const intro = newsText.substring(0, index1);
    const newsSection1 = newsText.substring(index1, index2);
    const newsSection2 = newsText.substring(index2);

    return { intro, newsSection1, newsSection2 };
}

function getPromptPart1(introText, editionNumber) {
    return `
Você é um editor de jornal digital (PITMUNEWS) com foco em design limpo e consistência. Sua tarefa é criar a **PARTE INTRODUTÓRIA** do jornal.

**REGRAS DE FORMATAÇÃO GERAL:**
- Para títulos de seção (ex: "HOJE É DIA...", "UTILIDADES"), use os emojis originais do texto-fonte.
- **NUNCA use asteriscos \`*\` para formatar títulos.** Deixe os títulos limpos.

**TEXTO DE ORIGEM (INTRODUÇÃO DO VINIMUNEWS):**
\`\`\`
${introText}
\`\`\`

**INSTRUÇÕES PARA ESTA PARTE:**

1.  **CABEÇALHO (Formato Exato):**
    📰 PITMUNEWS – Ano 1, Nº ${editionNumber} 🗞
    📌 De São Paulo-SP / SJBV-SP
    📅 [Extraia a data completa do texto de origem]

2.  **HOJE É DIA...**
    -   Use o título original \`🗓 HOJE É DIA...\`.
    -   Liste os itens da seção original, um por linha, com seus emojis.

3.  **UTILIDADES DO DIA**
    -   Crie o título \`⚙️ UTILIDADES DO DIA\`.
    -   Liste os seguintes itens de forma limpa, um por linha:
    -   \`⏳ Dia do Ano:\` [Extraia do texto de origem]
    -   \`🌘 Fase da Lua:\` [Extraia a fase e a visibilidade]
    -   \`☀ Tempo em São Paulo:\` [Resuma a previsão para SÃO PAULO/SP em uma frase]
    -   \`🪐 Horóscopo:\` [Resuma a previsão do signo em no máximo duas frases curtas]

4.  **NÃO INCLUA NADA MAIS.**
`;
}

function getPromptPart2(newsSection1) {
    return `
Você é um editor de jornal digital (PITMUNEWS). Sua tarefa é **EXTRAIR E REFORMATAR** as manchetes da seção de notícias gerais.

**REGRA DE EXTRAÇÃO (MUITO IMPORTANTE):**
- Sua função é replicar a formatação original do VINIMUNEWS para as notícias.
- Para **CADA** notícia das seções "🇧🇷 BRASIL GERAL", "🌎 INTERNACIONAL" e "🏞️ BRASIL REGIONAIS", você deve:
    1. Manter o emoji original (✍️, 🌎, 🚓, etc.).
    2. Manter o texto EXATO da manchete.
    3. **REMOVER a fonte no final** (ex: remover "(POD360)", "(CNN)", etc.).
- Apresente cada manchete reformatada em uma nova linha.
- **NÃO AGRUPE, NÃO RESUMA, NÃO CRIE PARÁGRAFOS.** Apenas extraia e limpe as manchetes.

**TEXTO DE ORIGEM (NOTÍCIAS GERAIS E REGIONAIS):**
\`\`\`
${newsSection1}
\`\`\`

**INSTRUÇÕES:**

1.  **TÍTULO DA SEÇÃO:**
    Comece com o título limpo: 🌎 GIRO DE NOTÍCIAS 🇧🇷

2.  **CONTEÚDO:**
    -   Aplique a **REGRA DE EXTRAÇÃO** para todas as notícias no texto de origem.
`;
}

function getPromptPart3(newsSection2, freeGames) {
    return `
Você é um editor de jornal digital (PITMUNEWS) que segue regras de formatação de maneira precisa. Sua tarefa é criar a **PARTE FINAL** do jornal, focada em notícias temáticas.

**REGRA DE EXTRAÇÃO (APLIQUE A TODAS AS SEÇÕES DE NOTÍCIAS):**
- Sua única tarefa é **EXTRAIR E REFORMATAR CADA MANCHETE**.
- **COMO FAZER:**
    1. Use o título e os emojis originais da seção do VINIMUNEWS, mas **REMOVA os asteriscos \`*\`**.
    2. Para cada notícia da seção, mantenha o emoji e o texto da manchete.
    3. **REMOVA a fonte no final** (ex: "(G1)", "(R7)").
- **NÃO RESUMA, NÃO CRIE PARÁGRAFOS, NÃO AGRUPE NOTÍCIAS.** Apenas liste as manchetes limpas, uma por linha.

**REGRA DE EXCLUSÃO:**
- **IGNORE COMPLETAMENTE** as seções de texto longo: \`AGROINFORMA\`, \`INFORMINDUSTRIA\`, \`FIQUE SABENDO\`, \`TURISMO\`, \`DEVOCIONAL\`, \`FAKENEWS\`, \`MORTES\`, e \`CULINARIA\`. Elas não devem aparecer no PITMUNEWS.

---
**TEXTO DE ORIGEM (SEÇÕES TEMÁTICAS):**
\`\`\`
${newsSection2}
\`\`\`
**JOGOS GRÁTIS DA EPIC GAMES HOJE:**
${freeGames}
---

**INSTRUÇÕES DETALHADAS:**

1.  **PROCESSE AS SEGUINTES SEÇÕES DE NOTÍCIAS (usando a REGRA DE EXTRAÇÃO):**
    -   \`GAMES\` (nesta seção, adicione a linha do jogo grátis da Epic, se houver, no formato "🎁 *Grátis na Epic:* [Nomes dos Jogos]").
    -   \`TECNOLOGIA & CIÊNCIA\`
    -   \`ECONOMIA\` (no final desta seção, adicione a linha de indicadores no formato EXATO: \`📊 Indicadores: Dólar [valor] [emoji] | Euro [valor] [emoji] | Bitcoin [valor] [emoji] | Petróleo [valor] [emoji]\`)
    -   \`SAÚDE\`
    -   \`ESPORTES\`
    -   \`FAMA & ENTRETENIMENTO\`

2.  **RODAPÉ OBRIGATÓRIO:**
    -   Finalize seu texto com este bloco EXATO:

📨 Você está lendo PITMUNEWS
🧠 Criado com: TogetherAI, VINIMUNEWS e APIs
🤖 Distribuído automaticamente pelo Botzin do ZipZop
`;
}

async function handleAutomaticNewsletter(message, client) {
    try {
        const newsText = message.body;

        let birthdayMessage = '';
        const birthdayNames = getBirthdayNames(newsText);
        if (birthdayNames.length > 0) {
            const names = birthdayNames.join(' e ');
            birthdayMessage = `🎂🎉 FELIZ ANIVERSÁRIO, ${names}! 🎉🎂\n\nUm beijão na vossa teta esquerda, muita saúde, dinheiro, falta doq fazer, e muitas felicidades!!!!\n\n`;
        }

        const parts = splitNewsletter(newsText);
        if (!parts) {
            await message.reply("Falha ao processar: a estrutura do VINIMUNEWS não pôde ser reconhecida. Verifique os marcadores de seção.");
            return;
        }

        const editionNumber = incrementNewsletterEditionNumber();
        const freeGames = await fetchEpicFreeGames();
        let freeGamesText = "Nenhum jogo grátis encontrado hoje.";
        if (freeGames.length > 0) {
            freeGamesText = freeGames.join(' | ');
        }

        const prompt1 = getPromptPart1(parts.intro, editionNumber);
        const prompt2 = getPromptPart2(parts.newsSection1);
        const prompt3 = getPromptPart3(parts.newsSection2, freeGamesText);

        const systemMessage = { role: "system", content: "Você é um assistente de redação de jornal automatizado, focado em seguir instruções precisamente para criar seções de um jornal." };

        await message.reply("Enviando Parte 1 para a IA...");
        const resultPart1 = await askAI([systemMessage, { role: "user", content: prompt1 }]);

        for (let i = 12; i > 0; i--) {
            await message.reply(`Aguardando ${i} segundo(s) para evitar rate limit...`);
            await delay(1000);
        }

        await message.reply("Enviando Parte 2 para a IA...");
        const resultPart2 = await askAI([systemMessage, { role: "user", content: prompt2 }]);

        for (let i = 12; i > 0; i--) {
            await message.reply(`Aguardando ${i} segundo(s) para evitar rate limit...`);
            await delay(1000);
        }

        await message.reply("Enviando Parte 3 para a IA...");
        const resultPart3 = await askAI([systemMessage, { role: "user", content: prompt3 }]);
        
        const generatedNewsletter = [resultPart1, resultPart2, resultPart3].join('\n\n');
        const fullNewsletter = birthdayMessage + generatedNewsletter;

        const allChats = await client.getChats();
        const targetGroups = allChats.filter(c =>
            c.isGroup &&
            chatWithNewsletter.some(
                name => c.name && c.name.trim().toLowerCase() === name.trim().toLowerCase()
            )
        );

        if (targetGroups.length > 0) {
            for (const group of targetGroups) {
                await client.sendMessage(group.id._serialized, fullNewsletter);
            }

            const stickerPath = path.join(__dirname, '../Newsletter.webp');
            if (fs.existsSync(stickerPath)) {
                try {
                    const webpBuffer = fs.readFileSync(stickerPath);
                    const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));
                    for (const group of targetGroups) {
                        await client.sendMessage(group.id._serialized, stickerMedia, {
                            sendMediaAsSticker: true,
                            stickerName: '',
                            stickerAuthor: ''
                        });
                    }
                } catch (err) {
                }
            }
        } else {
            await message.reply(fullNewsletter);
        }
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        await message.reply(`Ocorreu um erro crítico ao gerar ou enviar o jornal. Detalhe: ${errorMessage}`);
    }
}

async function handleNewsletterCommands(message, client) {
    const contact = await message.getContact();
    if (contact.name === "Newsletter") {
        await handleAutomaticNewsletter(message, client);
        return true;
    }
    return false;
}

module.exports = { handleNewsletterCommands };