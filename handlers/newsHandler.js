// handlers/newsHandler.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { perguntarIA } = require('../services/aiService');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf8'));

const NEWSLETTER_AUTHOR_ID = CONFIG.newsletter.authorId;
const chatWithNewsletter = CONFIG.newsletter.chatGroups;
const ANIVERSARIANTES_ESPECIAIS = CONFIG.aniversariantes;
const COUNTER_FILE = path.join(__dirname, 'assets/pitmunews_counter.json');


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getEditionNumber() {
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
            return data.edition || 1;
        }
    } catch { }
    return 1;
}

function incrementEditionNumber() {
    const currentEdition = getEditionNumber();
    const newEdition = currentEdition + 1;
    try {
        fs.writeFileSync(COUNTER_FILE, JSON.stringify({ edition: newEdition }), 'utf8');
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

async function fetchEconomicIndicators() {
    try {
        const moedas = await axios.get("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL");
        const usd = parseFloat(moedas.data.USDBRL.bid).toFixed(2);
        const eur = parseFloat(moedas.data.EURBRL.bid).toFixed(2);

        const btcRes = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl");
        const btc = btcRes.data.bitcoin.brl.toLocaleString("pt-BR");

        const petroRes = await axios.get("https://query1.finance.yahoo.com/v8/finance/chart/CL=F");
        const petro = petroRes.data.chart.result[0].meta.regularMarketPrice.toFixed(2);

        const up = "📈";

        return `📊 Indicadores: Dólar R$${usd} ${up} | Euro R$${eur} ${up} | Bitcoin R$${btc} ${up} | Petróleo US$${petro} ${up}`;
    } catch (error) {
        console.error("Erro ao buscar indicadores econômicos:", error.message);
        return "📊 Indicadores: Não foi possível carregar hoje.";
    }
}

function checkAniversariantes(textoDoJornal) {
    const regexData = /(\d{1,2}) de (\w+) de (\d{4})/;
    const match = textoDoJornal.match(regexData);
    if (!match) return [];

    const dia = parseInt(match[1], 10);
    const mesTexto = match[2].toLowerCase();

    const meses = { 'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12 };
    const mes = meses[mesTexto];
    if (!mes) return [];

    const diaFormatado = String(dia).padStart(2, '0');
    const mesFormatado = String(mes).padStart(2, '0');
    const dataAtualFormatada = `${diaFormatado}/${mesFormatado}`;

    return ANIVERSARIANTES_ESPECIAIS
        .filter(p => p.data === dataAtualFormatada)
        .map(p => p.nome);
}

function splitViniMunews(textoCompleto) {
    const inicioSecaoNoticias1 = '*🇧🇷 BRASIL GERAL*';
    const possiveisSecoes2 = [
        '*💓 SAÚDE 💓*',
        '*💻 TECNOLOGIA & CIÊNCIA*',
        '*🎮 GAMES*'
    ];
    const possiveisSecoes3 = [
        '*💰 ECONOMIA*',
        '*⚽🏀 ESPORTES*',
        '*🌟 FAMA & ENTRETENIMENTO*'
    ];

    const index1 = textoCompleto.indexOf(inicioSecaoNoticias1);
    if (index1 === -1) {
        console.error("Seção 'BRASIL GERAL' não encontrada.");
        return null;
    }

    let index2 = -1;
    for (const secao of possiveisSecoes2) {
        const i = textoCompleto.indexOf(secao, index1);
        if (i !== -1 && i > index1) {
            index2 = i;
            break;
        }
    }

    let index3 = -1;
    for (const secao of possiveisSecoes3) {
        const i = textoCompleto.indexOf(secao, index2 !== -1 ? index2 : index1);
        if (i !== -1 && i > (index2 !== -1 ? index2 : index1)) {
            index3 = i;
            break;
        }
    }

    const introducao = textoCompleto.substring(0, index1);
    const secaoNoticias1 = index2 !== -1 ? textoCompleto.substring(index1, index2) : 
                            index3 !== -1 ? textoCompleto.substring(index1, index3) : 
                            textoCompleto.substring(index1);

    const secaoNoticias2 = index2 !== -1 ? (index3 !== -1 ? textoCompleto.substring(index2, index3) : textoCompleto.substring(index2)) : '';
    const secaoNoticias3 = index3 !== -1 ? textoCompleto.substring(index3) : '';

    return { introducao, secaoNoticias1, secaoNoticias2, secaoNoticias3 };
}

function getPromptParte1(textoIntroducao, editionNumber) {
    return `
Você é um editor de jornal digital (PITMUNEWS) com foco em design limpo e consistência. Sua tarefa é criar a **PARTE INTRODUTÓRIA** do jornal.

**REGRAS DE FORMATAÇÃO GERAL:**
- A saída deve ser **TEXTO PURO**.
- **NUNCA use formatação markdown**, como \`*\`, \`###\` ou \`\`\`
- Para títulos de seção (ex: "HOJE É DIA...", "UTILIDADES"), use os emojis originais do texto-fonte e deixe os títulos limpos.

**TEXTO DE ORIGEM (INTRODUÇÃO DO VINIMUNEWS):**
\`\`\`
${textoIntroducao}
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

function getPromptParte2(textoNoticias1) {
    return `
Você é um editor de jornal digital (PITMUNEWS). Sua tarefa é **EXTRAIR E REFORMATAR** as manchetes da seção de notícias gerais.

**REGRA DE EXTRAÇÃO (MUITO IMPORTANTE):**
- Sua saída deve ser **TEXTO PURO**, sem formatação markdown (\`###\`, \`\`\`, etc).
- Para **CADA** notícia das seções "🇧🇷 BRASIL GERAL", "🌎 INTERNACIONAL" e "🏞️ BRASIL REGIONAIS", você deve:
    1. Manter o emoji original (✍️, 🌎, 🚓, etc.).
    2. Manter o texto EXATO da manchete.
    3. **REMOVER a fonte no final** (ex: remover "(POD360)", "(CNN)", etc.).
- Apresente cada manchete reformatada em uma nova linha.
- **NÃO AGRUPE, NÃO RESUMA, NÃO CRIE PARÁGRAFOS.** Apenas extraia e limpe as manchetes.

**TEXTO DE ORIGEM (NOTÍCIAS GERAIS E REGIONAIS):**
\`\`\`
${textoNoticias1}
\`\`\`

**INSTRUÇÕES:**

1.  **TÍTULO DA SEÇÃO:**
    Comece com o título limpo: 🌎 GIRO DE NOTÍCIAS 🇧🇷

2.  **CONTEÚDO:**
    -   Aplique a **REGRA DE EXTRAÇÃO** para todas as notícias no texto de origem.
`;
}

function getPromptParte3(textoNoticias2, jogosGratis) {
    return `
Você é um editor de jornal digital (PITMUNEWS) que segue regras de formatação de maneira precisa. Sua tarefa é criar a parte de **TECNOLOGIA, SAÚDE E GAMES** do jornal.

**REGRAS DE FORMATAÇÃO (MUITO IMPORTANTE):**
- A saída final deve ser **TEXTO PURO**.
- **NÃO use NENHUM tipo de formatação markdown**, como \`###\` para títulos ou \`\`\` para blocos de código.
- Extraia APENAS as manchetes que já estiverem no texto abaixo.
- Mantenha os emojis originais no início de cada manchete.
- Remova fontes no final da linha (ex: "(CNN)").
- Apresente cada manchete em uma linha separada.
- Comece cada seção com seu título em uma nova linha, contendo apenas os emojis e o nome da seção. Exemplo:
  💓 SAÚDE 💓
  🧪 TECNOLOGIA & CIÊNCIA 🧪
  🎮 GAMES 🎮

- Na seção GAMES, ao final da lista de manchetes, adicione esta linha:
🎁 Grátis na Epic: ${jogosGratis}

**TEXTO ORIGINAL:**
\`\`\`
${textoNoticias2}
\`\`\`
`;
}

function getPromptParte4(textoNoticias3, indicadores) {
    return `
Você é um editor de jornal digital (PITMUNEWS). Sua tarefa é criar a parte de **ECONOMIA, ESPORTES E ENTRETENIMENTO**.

**REGRAS DE FORMATAÇÃO (MUITO IMPORTANTE):**
- A saída final deve ser **TEXTO PURO**.
- **NÃO use NENHUM tipo de formatação markdown**, como \`###\` para títulos ou \`\`\` para blocos de código.
- Extraia APENAS as manchetes dessas seções que já estiverem no texto abaixo.
- Mantenha os emojis originais no início de cada manchete.
- Remova fontes no final da linha (ex: "(CNN)").
- Apresente cada manchete em uma linha separada.
- Comece cada seção com seu título em uma nova linha, contendo apenas os emojis e o nome da seção. Exemplo:
  💰 ECONOMIA 💰
  🏆 ESPORTES 🏆
  🌟 FAMA & ENTRETENIMENTO 🌟

- Na seção ECONOMIA, ao final da lista de manchetes, adicione a linha de indicadores:
${indicadores}

- Finalize seu texto com este rodapé **EXATO**:

📨 Você está lendo PITMUNEWS
🧠 Criado com: MaritacaAI, VINIMUNEWS e APIs
🤖 Distribuído automaticamente pelo Botzin do ZipZop

**TEXTO ORIGINAL:**
\`\`\`
${textoNoticias3}
\`\`\`
`;
}

async function fetchLatestYoutubeVideo(channelId, apiKey) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&order=date&part=snippet&type=video&maxResults=4`;
    try {
        const response = await axios.get(url);
        const video = response.data.items[3];
        if (!video) return null;
        return `https://www.youtube.com/watch?v=${video.id.videoId}`;
    } catch (error) {
        console.error("Erro ao buscar vídeo do YouTube:", error.message);
        return null;
    }
}

async function processarParteIA(prompt, parteIndex) {
    let tentativas = 0;
    const maxTentativas = 3;

    while (tentativas < maxTentativas) {
        try {
            tentativas++;
            console.log(`Enviando Parte ${parteIndex + 1} para a IA (tentativa ${tentativas}/${maxTentativas})...`);
            const resultado = await perguntarIA(prompt);
            console.log(`Parte ${parteIndex + 1} processada com sucesso!`);
            return resultado;
        } catch (error) {
            console.error(`Erro ao processar Parte ${parteIndex + 1} (Tentativa ${tentativas}):`, error.message);
            if (tentativas < maxTentativas) {
                console.log("Aguardando 60 segundos antes de tentar novamente...");
                await delay(60 * 1000);
            } else {
                throw new Error("Falha definitiva após 3 tentativas.");
            }
        }
    }
    throw new Error("Falha ao processar a parte na IA.");
}

async function handleAutomaticNews(message, client) {
    try {
        console.log("Iniciando processamento do VINIMUNEWS...");
        const textoCompletoDoEditor = message.body;

        let mensagemAniversario = '';
        const aniversariantesDoDia = checkAniversariantes(textoCompletoDoEditor);
        if (aniversariantesDoDia.length > 0) {
            const nomes = aniversariantesDoDia.join(' e ');
            mensagemAniversario = `🎂🎉 FELIZ ANIVERSÁRIO, ${nomes}! 🎉🎂\n\nUm beijão na vossa teta esquerda, muita saúde, dinheiro, falta doq fazer, e muitas felicidades!!!!\n\n`;
            console.log(`Aniversário detectado para: ${nomes}`);
        }

        const partes = splitViniMunews(textoCompletoDoEditor);
        if (!partes) {
            console.error("Falha ao processar: a estrutura do VINIMUNEWS não pôde ser reconhecida. Verifique os marcadores de seção.");
            return;
        }
        console.log("Jornal dividido em 4 partes com sucesso.");

        const editionNumber = incrementEditionNumber();
        const freeGames = await fetchEpicFreeGames();
        let freeGamesText = "Nenhum jogo grátis encontrado hoje.";
        if (freeGames.length > 0) {
            freeGamesText = freeGames.join(' | ');
        }

        const channelId = 'UCLzb8VJaApoEZ6Bbmmq-oEA';
        const apiKey = process.env.YT_API_KEY;
        const latestVideoUrl = await fetchLatestYoutubeVideo(channelId, apiKey);
        const videoMsg = latestVideoUrl
            ? `👁️ Última mensagem do Mestre:\n ${latestVideoUrl} `
            : 'Não foi possível carregar o vídeo do Mestre hoje.\n';

        const indicadores = await fetchEconomicIndicators();
        const prompt1 = getPromptParte1(partes.introducao, editionNumber);
        const prompt2 = getPromptParte2(partes.secaoNoticias1);
        const prompt3 = getPromptParte3(partes.secaoNoticias2, freeGamesText);
        const prompt4 = getPromptParte4(partes.secaoNoticias3, indicadores);

        const systemMessage = { role: "system", content: "Você é um assistente de redação de jornal automatizado, focado em seguir instruções precisamente para criar seções de um jornal." };
        
        const DELAY_ENTRE_PARTES = CONFIG.ia.delayEntreParcelas;

        const resultadoParte1 = await processarParteIA([systemMessage, { role: "user", content: prompt1 }], 0);
        await delay(DELAY_ENTRE_PARTES);

        const resultadoParte2 = await processarParteIA([systemMessage, { role: "user", content: prompt2 }], 1);
        await delay(DELAY_ENTRE_PARTES);

        const resultadoParte3 = await processarParteIA([systemMessage, { role: "user", content: prompt3 }], 2);
        await delay(DELAY_ENTRE_PARTES);

        const resultadoParte4 = await processarParteIA([systemMessage, { role: "user", content: prompt4 }], 3);

        console.log("Todas as partes recebidas da IA.");

        const jornalGerado = [
            mensagemAniversario + resultadoParte1,
            videoMsg,                              
            resultadoParte2,                       
            resultadoParte3,                       
            resultadoParte4                        
        ].join('\n\n');

        const jornalCompleto = jornalGerado;

        const tmpFile = path.join(__dirname, 'assets/tmp/pitmunews.txt');
        try {
            const tmpDir = path.dirname(tmpFile);
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }
            if (fs.existsSync(tmpFile)) {
                fs.unlinkSync(tmpFile);
            }
            fs.writeFileSync(tmpFile, jornalCompleto, 'utf8');
            console.log(`Jornal salvo em: ${tmpFile}`);
        } catch (err) {
            console.error("Erro ao salvar o jornal temporário:", err);
        }

        async function getChatsWithRetry(clientObj, maxAttempts = 3) {
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const chats = await clientObj.getChats();
                    if (!chats || chats.length === 0) {
                        throw new Error('returned no chats');
                    }
                    return chats;
                } catch (err) {
                    attempts++;
                    console.error(`Falha ao obter chats (tentativa ${attempts}/${maxAttempts}):`, err);
                    if (err && err.stack) console.error(err.stack);

                    if (attempts < maxAttempts) {

                        await delay(5000);
                        try {
                            if (clientObj.pupPage && typeof clientObj.pupPage.reload === 'function') {
                                await clientObj.pupPage.reload({ waitUntil: 'networkidle2' });
                            }
                        } catch (reloadErr) {
                            console.warn('Falha ao recarregar a página do Puppeteer:', reloadErr.message);
                        }
                    } else {
                        throw err;
                    }
                }
            }
        }

        let allChats = [];
        try {
            allChats = await getChatsWithRetry(client);

            console.log('================ Chats recebidos ================');
            allChats.forEach(c => {
                const name = c.name || '<sem nome>';
                const id = c.id?._serialized || '<sem id>';
                console.log(`- ${name} (${id})`);
            });
            console.log('================================================');
        } catch (err) {
            console.error("Erro irrecuperável ao recuperar chats, enviarei apenas à mensagem original:", err);
        }

        allChats = Array.isArray(allChats) ? allChats : [];

        const targetGroups = allChats.filter(c => {
            if (!c.isGroup) return false;
            const id = c.id?._serialized;
            const name = c.name;
            const matchById = id && chatWithNewsletter.includes(id);
            const matchByName = name && chatWithNewsletter.includes(name);
            if (matchById) console.log(`grupo corresponde por ID: ${id}`);
            if (matchByName) console.log(`grupo corresponde por nome: ${name}`);
            return matchById || matchByName;
        });

        if (targetGroups.length > 0) {
            console.log(`Enviando PITMUNEWS Nº ${editionNumber} para ${targetGroups.length} grupo(s).`);
            for (const group of targetGroups) {
                await client.sendMessage(group.id._serialized, jornalCompleto);
            }
            const stickerPath = path.join(__dirname, 'assets/Newsletter.webp');
            if (fs.existsSync(stickerPath)) {
                const stickerMedia = MessageMedia.fromFilePath(stickerPath);
                for (const group of targetGroups) {
                     await client.sendMessage(group.id._serialized, stickerMedia, { sendMediaAsSticker: true });
                }
            }
            console.log("Envio concluído com sucesso.");
        } else {
            console.warn("Jornal gerado, mas nenhum grupo de destino foi encontrado.");

            await message.reply(jornalCompleto);
        }
    } catch (error) {
        console.error("Erro no fluxo principal de handleAutomaticNews:", error);
        const errorMessage = error.response?.data?.error?.message || error.message;
        if (errorMessage && errorMessage !== error.toString()) {
            console.error("Mensagem de erro detalhada:", errorMessage);
        }
    }
}

async function handleNewsCommands(message, client) {
    try {
        const chat = await message.getChat();
        
        const isNewsletter = message.author === NEWSLETTER_AUTHOR_ID;
        
        if (isNewsletter) {
            console.log("[Newsletter] Detectado por author ID");
            await handleAutomaticNews(message, client);
            return true;
        }
    } catch (error) {
        console.error("[Newsletter] Erro:", error.message);
    }
    return false;
}

module.exports = { handleNewsCommands };
