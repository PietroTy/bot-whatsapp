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

function getMessageId(message) {
    if (!message) return null;
    if (typeof message.id === 'string' && message.id.length > 0) return message.id;
    if (message.id && typeof message.id === 'object') {
        if (message.id._serialized) return message.id._serialized;
        if (message.id.id) return message.id.id;
    }
    if (message._data && message._data.id) {
        if (typeof message._data.id === 'string') return message._data.id;
        if (message._data.id._serialized) return message._data.id._serialized;
        if (message._data.id.id) return message._data.id.id;
    }
    return null;
}

function getTodayDateString() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function incrementEditionNumber(messageId) {
    const currentEdition = getEditionNumber();
    const newEdition = currentEdition + 1;
    const safeMsgId = messageId || `msg_${Date.now()}`;
    const todayStr = getTodayDateString();
    try {
        fs.writeFileSync(COUNTER_FILE, JSON.stringify({ 
            edition: newEdition,
            lastProcessedId: safeMsgId,
            lastProcessedDate: todayStr
        }, null, 2), 'utf8');
    } catch (error) {
        console.error("Erro ao salvar o contador do jornal:", error);
    }
    return newEdition;
}

async function fetchGamerPowerGames() {
    try {
        const response = await axios.get("https://www.gamerpower.com/api/giveaways?platform=pc&type=game", { timeout: 8000 });
        if (!response.data || !Array.isArray(response.data)) return [];
        const pcGames = response.data.filter(g => {
            const plat = (g.platforms || '').toLowerCase();
            return !plat.includes('android') && !plat.includes('ios') && !plat.includes('mobile');
        });
        return pcGames.slice(0, 5).map(g => ({
            title: g.title ? g.title.replace(/\s*Giveaway$/i, '').trim() : 'Jogo Grátis',
            platforms: g.platforms || 'PC',
            description: g.description ? g.description.replace(/[\r\n]+/g, ' ').trim() : ''
        }));
    } catch (error) {
        console.error("Erro ao buscar jogos grátis no GamerPower:", error.message);
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

function checkAniversariantesDoGrupo(textoDoJornal, listaMembros) {
    if (!Array.isArray(listaMembros) || listaMembros.length === 0) return [];

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

    return listaMembros
        .filter(p => p.data === dataAtualFormatada)
        .map(p => p.nome);
}



async function fetchWeather() {
    try {
        const urlSP = "https://api.open-meteo.com/v1/forecast?latitude=-23.5489&longitude=-46.6388&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America/Sao_Paulo&forecast_days=1";
        const urlSJ = "https://api.open-meteo.com/v1/forecast?latitude=-21.9686&longitude=-46.7978&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America/Sao_Paulo&forecast_days=1";

        const [resSP, resSJ] = await Promise.all([
            axios.get(urlSP),
            axios.get(urlSJ)
        ]);

        const weatherCodes = {
            0: "Céu limpo",
            1: "Principalmente limpo", 2: "Parcialmente nublado", 3: "Nublado",
            45: "Nevoeiro", 48: "Nevoeiro com geada",
            51: "Chuvisco leve", 53: "Chuvisco moderado", 55: "Chuvisco denso",
            56: "Chuvisco congelante leve", 57: "Chuvisco congelante denso",
            61: "Chuva leve", 63: "Chuva moderada", 65: "Chuva forte",
            66: "Chuva congelante leve", 67: "Chuva congelante forte",
            71: "Queda de neve leve", 73: "Queda de neve moderada", 75: "Queda de neve forte",
            77: "Granizo",
            80: "Aguaceiros leves", 81: "Aguaceiros moderados", 82: "Aguaceiros violentos",
            85: "Aguaceiros de neve leves", 86: "Aguaceiros de neve fortes",
            95: "Trovoada leve ou moderada",
            96: "Trovoada com granizo leve", 99: "Trovoada com granizo forte"
        };

        const getDesc = (code) => weatherCodes[code] || "Tempo instável";

        const tempMaxSP = Math.round(resSP.data.daily.temperature_2m_max[0]);
        const tempMinSP = Math.round(resSP.data.daily.temperature_2m_min[0]);
        const codeSP = resSP.data.daily.weathercode[0];
        const descSP = getDesc(codeSP);

        const tempMaxSJ = Math.round(resSJ.data.daily.temperature_2m_max[0]);
        const tempMinSJ = Math.round(resSJ.data.daily.temperature_2m_min[0]);
        const codeSJ = resSJ.data.daily.weathercode[0];
        const descSJ = getDesc(codeSJ);

        return `São Paulo: ${descSP}, ${tempMinSP}°C a ${tempMaxSP}°C | SJBV: ${descSJ}, ${tempMinSJ}°C a ${tempMaxSJ}°C`;
    } catch (error) {
        console.error("Erro ao buscar previsão do tempo:", error.message);
        return "Previsão indisponível hoje.";
    }
}



function splitViniMunews(textoCompleto) {
    if (!textoCompleto || typeof textoCompleto !== 'string' || textoCompleto.length < 200) {
        return null;
    }

    const regex1 = /\*?🇧🇷\s*BRASIL GERAL\*?/i;
    const regexes2 = [
        /\*?💓\s*SAÚDE\s*💓\*?/i,
        /\*?💻\s*TECNOLOGIA\s*&\s*CIÊNCIA\*?/i,
        /\*?🎮\s*GAMES\*?/i
    ];
    const regexes3 = [
        /\*?💰\s*ECONOMIA\*?/i,
        /\*?⚽🏀\s*ESPORTES\*?/i,
        /\*?🌟\s*FAMA\s*&\s*ENTRETENIMENTO\*?/i
    ];

    const match1 = textoCompleto.match(regex1);
    const hasHeader = /VINIMUNEWS|HOJE É DIA/i.test(textoCompleto);

    if (!match1 || !hasHeader) {
        // Mensagem avulsa ou aviso (não possui a estrutura completa do jornal)
        return null;
    }
    const index1 = match1.index;

    let index2 = -1;
    for (const reg of regexes2) {
        const m = textoCompleto.slice(index1).match(reg);
        if (m) {
            index2 = index1 + m.index;
            break;
        }
    }

    let index3 = -1;
    const searchStart3 = index2 !== -1 ? index2 : index1;
    for (const reg of regexes3) {
        const m = textoCompleto.slice(searchStart3).match(reg);
        if (m) {
            index3 = searchStart3 + m.index;
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

function getPromptParte1(textoIntroducao, editionNumber, previsaoTempo, listaCurtaJogos) {
    return `
Você é um editor de jornal digital (PITMUNEWS) com foco em design limpo e consistência. Sua tarefa é criar a **PARTE INTRODUTÓRIA** do jornal.

**REGRAS DE FORMATAÇÃO GERAL:**
- A saída deve ser **TEXTO PURO**.
- **NUNCA use formatação markdown**, como \`*\`, \`###\` ou \`\`\`
- Para títulos de seção (ex: "HOJE É DIA...", "UTILIDADES"), use os emojis originais do texto-fonte e deixe os títulos limpos.
- A resposta deve ser **INTEIRAMENTE em português do Brasil (pt-BR)**. Nunca traduza os cabeçalhos, termos ou títulos para outro idioma (como chinês ou inglês).

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
    -   \`☀ Previsão do Tempo:\` ${previsaoTempo}
    -   \`🎮 Jogos Grátis do Dia:\`
${listaCurtaJogos}
    -   \`🎂 Aniversário de Famosos:\` [Escolha de 3 a 5 dos aniversariantes mais conhecidos e relevantes para o público brasileiro da seção "🎂 FAMOSOS ANIVERSARIANTES" no texto de origem (remova as bandeiras de país/emojis e reordene a idade em formato de parênteses se necessário, mantendo o padrão Nome (idade) - descrição. Exemplo: Alesso (35 anos) - DJ Produtor Musical)]
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

function getPromptParte3(textoNoticias2, listaDetalhadaJogos) {
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

- Na seção GAMES, ao final da lista de manchetes, adicione a seção de jogos grátis da semana:

🎁 JOGOS GRÁTIS DA SEMANA:
${listaDetalhadaJogos}

**TEXTO ORIGINAL:**
\`\`\`
${textoNoticias2}
\`\`\`
`;
}

function getPromptParte4(textoNoticias3, indicadores) {
    return `
Você é um editor de jornal digital (PITMUNEWS). Sua tarefa é criar a parte de **ECONOMIA E ESPORTES**.

**REGRAS DE FORMATAÇÃO (MUITO IMPORTANTE):**
- A saída final deve ser **TEXTO PURO**.
- **NÃO use NENHUM tipo de formatação markdown**, como \`###\` para títulos ou \`\`\` para blocos de código.
- Extraia APENAS as manchetes de ECONOMIA e ESPORTES que já estiverem no texto abaixo.
- Mantenha os emojis originais no início de cada manchete.
- Remova fontes no final da linha (ex: "(CNN)").
- Apresente cada manchete em uma linha separada.
- Comece cada seção com seu título em uma nova linha, contendo apenas os emojis e o nome da seção. Exemplo:
  💰 ECONOMIA 💰
  🏆 ESPORTES 🏆
- **NÃO inclua a seção de Fama, Entretenimento ou qualquer outra que não seja Economia ou Esportes.**

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

        const partes = splitViniMunews(textoCompletoDoEditor);
        if (!partes) {
            console.error("Falha ao processar: a estrutura do VINIMUNEWS não pôde ser reconhecida. Verifique os marcadores de seção.");
            return;
        }
        console.log("Jornal dividido em 4 partes com sucesso.");

        const editionNumber = incrementEditionNumber(getMessageId(message));

        const [freeGamesList, weather] = await Promise.all([
            fetchGamerPowerGames(),
            fetchWeather()
        ]);

        const listaCurtaJogos = freeGamesList.length > 0 
            ? freeGamesList.map(g => `   - ${g.title} - ${g.platforms}`).join('\n')
            : '   - Nenhum jogo grátis novo hoje.';

        const listaDetalhadaJogos = freeGamesList.length > 0
            ? freeGamesList.map(g => `🎮 ${g.title} (${g.platforms}): ${g.description}`).join('\n')
            : '🎮 Nenhum jogo grátis novo hoje.';

        const channelId = 'UCLzb8VJaApoEZ6Bbmmq-oEA';
        const apiKey = process.env.YT_API_KEY;
        const latestVideoUrl = await fetchLatestYoutubeVideo(channelId, apiKey);
        const videoMsg = latestVideoUrl
            ? `👁️ Última mensagem do Mestre:\n ${latestVideoUrl} `
            : 'Não foi possível carregar o vídeo do Mestre hoje.\n';

        const indicadores = await fetchEconomicIndicators();
        const prompt1 = getPromptParte1(partes.introducao, editionNumber, weather, listaCurtaJogos);
        const prompt2 = getPromptParte2(partes.secaoNoticias1);
        const prompt3 = getPromptParte3(partes.secaoNoticias2, listaDetalhadaJogos);
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
            resultadoParte1,
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

            // O log de chats foi removido para evitar poluição no console.
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
                const groupId = group.id._serialized;
                let finalJornalParaGrupo = jornalGerado;

                // Checa se este grupo possui aniversariantes e mensagem específica
                const groupConfig = CONFIG.gruposAniversarios?.[groupId];
                if (groupConfig && Array.isArray(groupConfig.membros)) {
                    const aniversariantesDoDia = checkAniversariantesDoGrupo(textoCompletoDoEditor, groupConfig.membros);
                    if (aniversariantesDoDia.length > 0) {
                        const nomes = aniversariantesDoDia.join(' e ');
                        const customMsg = groupConfig.mensagem ? groupConfig.mensagem.replace('{nomes}', nomes) : `🎂🎉 FELIZ ANIVERSÁRIO, ${nomes}! 🎉🎂\n\n`;
                        finalJornalParaGrupo = customMsg + jornalGerado;
                        console.log(`Aniversário detectado no grupo "${groupConfig.nomeGrupo || groupId}" para: ${nomes}`);
                    }
                }

                await client.sendMessage(groupId, finalJornalParaGrupo);
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

function getTimestampLog() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
}

const RAW_NEWSLETTER_CACHE = path.join(__dirname, 'assets/tmp/last_newsletter_raw.txt');

function saveNewsletterCache(text) {
    try {
        const dir = path.dirname(RAW_NEWSLETTER_CACHE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(RAW_NEWSLETTER_CACHE, text, 'utf8');
    } catch (e) {}
}

function getNewsletterCache() {
    try {
        if (fs.existsSync(RAW_NEWSLETTER_CACHE)) {
            const text = fs.readFileSync(RAW_NEWSLETTER_CACHE, 'utf8');
            if (text && splitViniMunews(text)) {
                return text;
            }
        }
    } catch (e) {}
    return null;
}

const SOURCE_GROUPS = CONFIG.newsletter.sourceGroups || ["120363417435454821@g.us", NEWSLETTER_AUTHOR_ID];

async function findLatestNewsletterMsg(client) {
    // 1. Tenta buscar a mensagem diretamente no grupo de origem "VINIMUNEWS 📰🗞️ 4" (120363417435454821@g.us)
    if (client) {
        try {
            const sourceGroupId = "120363417435454821@g.us";
            const groupChat = await client.getChatById(sourceGroupId);
            if (groupChat && typeof groupChat.fetchMessages === 'function') {
                const msgs = await groupChat.fetchMessages({ limit: 30 });
                if (msgs && msgs.length > 0) {
                    for (let i = msgs.length - 1; i >= 0; i--) {
                        const m = msgs[i];
                        if (m && m.body && splitViniMunews(m.body) !== null) {
                            saveNewsletterCache(m.body);
                            return m;
                        }
                    }
                }
            }
        } catch (groupErr) {
            console.warn("Aviso ao buscar mensagens no grupo VINIMUNEWS 4:", groupErr.message);
        }
    }

    // 2. Tenta buscar via Puppeteer na memória do Store.Msg
    if (client && client.pupPage) {
        try {
            const storeResult = await client.pupPage.evaluate(() => {
                let msgs = [];
                if (window.Store && window.Store.Msg && window.Store.Msg.models) {
                    msgs = msgs.concat(window.Store.Msg.models);
                }
                if (window.Store && window.Store.NewsletterMsgs && window.Store.NewsletterMsgs.models) {
                    msgs = msgs.concat(window.Store.NewsletterMsgs.models);
                }
                const filtered = [];
                const searchKeys = ['120363417435454821', '231790962819089', '5513996911070', '996911070'];
                for (const m of msgs) {
                    const author = String(m.author?._serialized || m.author || m.from?._serialized || m.from || m.id?.remote || '');
                    const body = m.body || m.caption || '';
                    if (searchKeys.some(k => author.includes(k)) && body.length > 100) {
                        filtered.push({
                            id: m.id?._serialized || m.id?.id || String(m.id),
                            body: body,
                            timestamp: m.t || m.timestamp || 0
                        });
                    }
                }
                filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                return filtered.length > 0 ? filtered[0] : null;
            });

            if (storeResult && storeResult.body && splitViniMunews(storeResult.body) !== null) {
                saveNewsletterCache(storeResult.body);
                return {
                    body: storeResult.body,
                    id: { _serialized: storeResult.id },
                    timestamp: storeResult.timestamp
                };
            }
        } catch (err) {
            console.warn("Aviso: Erro ao consultar Store no Puppeteer:", err.message);
        }
    }

    // 3. Fallback: Tenta carregar do cache salvo em disco se existir
    const cachedText = getNewsletterCache();
    if (cachedText) {
        return {
            body: cachedText,
            id: { _serialized: `cached_raw_${Date.now()}` },
            timestamp: Math.floor(Date.now() / 1000)
        };
    }

    return null;
}

async function handleNewsCommands(message, client) {
    try {
        // Extrai o author de forma resiliente, igual ao padrão do stickerHandler
        const authorResolvido =
            message.author ||
            message._data?.author ||
            message._data?.authorId ||
            message._data?.id?.participant ||
            null;

        const fromGroupOrAuthor = `${message.from || ''} ${authorResolvido || ''}`;
        const isFromSource = SOURCE_GROUPS.some(sg => fromGroupOrAuthor.includes(sg.split('@')[0]));
        const isNewsletter = isFromSource && message.body && splitViniMunews(message.body) !== null;
        const msgId = getMessageId(message);

        if (isNewsletter && message.body) {
            saveNewsletterCache(message.body);
        }

        /*
        // Suporte a comando manual `#jornal` ou `#pitmunews` (desativado/comentado)
        const text = message.body ? message.body.trim().toLowerCase() : '';
        if (text === '#jornal' || text === '#pitmunews') {
            if (message.hasQuotedMsg) {
                const quoted = await message.getQuotedMessage();
                if (quoted && quoted.body) {
                    await message.reply("Iniciando geração manual do PITMUNEWS a partir da mensagem citada...");
                    await handleAutomaticNews(quoted, client);
                    return true;
                }
            }
            
            // Se não citou nenhuma mensagem, busca automaticamente a última do canal na memória/cache
            await message.reply("🔍 Buscando a última edição do jornal no canal da newsletter...");
            const targetMsg = await findLatestNewsletterMsg(client);

            if (targetMsg) {
                await message.reply("📰 Última edição da newsletter encontrada! Gerando o PITMUNEWS...");
                await handleAutomaticNews(targetMsg, client);
                return true;
            } else {
                await message.reply("⚠️ Nenhuma edição do jornal foi encontrada na memória ainda. Responda/cite a mensagem do jornal diretamente com `#jornal`.");
                return true;
            }
        }
        */

        if (isNewsletter) {
            console.log(`${getTimestampLog()} [Newsletter] Detectada mensagem da newsletter. Verificando filtros...`);

            const counterData = fs.existsSync(COUNTER_FILE) ? JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')) : {};
            const todayStr = getTodayDateString();

            // 1. Filtro de 1 jornal por dia: se já foi enviado um jornal hoje, ignora novas mensagens automáticas
            if (counterData.lastProcessedDate === todayStr) {
                console.log(`${getTimestampLog()} [Newsletter] Mensagem ignorada: já foi enviado um jornal hoje (${todayStr}). Limite de 1 por dia.`);
                return false;
            }

            // 2. Verifica se este ID de mensagem já foi processado para evitar duplicidade
            if (msgId && counterData.lastProcessedId && counterData.lastProcessedId === msgId) {
                console.log(`${getTimestampLog()} [Newsletter] Mensagem já processada anteriormente (${msgId}). Ignorando.`);
                return false;
            }

            // 2. Filtro de Timestamp: Idade máxima da mensagem (para ignorar histórico antigo no boot)
            if (message.timestamp) {
                const nowSec = Math.floor(Date.now() / 1000);
                const ageSec = nowSec - message.timestamp;
                const maxAgeMinutes = CONFIG.newsletter.maxAgeMinutes || 15;
                const maxAgeSec = maxAgeMinutes * 60;

                if (ageSec > maxAgeSec) {
                    console.log(`${getTimestampLog()} [Newsletter] Mensagem ignorada: antiga (recebida há ${Math.round(ageSec / 60)} min, limite: ${maxAgeMinutes} min).`);
                    return false;
                }

                // 3. Filtro de Horário: Apenas envia no intervalo especificado (ex: 05h às 14h)
                const msgDate = new Date(message.timestamp * 1000);
                const msgHour = msgDate.getHours();
                const startHour = CONFIG.newsletter.startHour ?? 5;
                const endHour = CONFIG.newsletter.endHour ?? 14;

                if (msgHour < startHour || msgHour >= endHour) {
                    console.log(`${getTimestampLog()} [Newsletter] Mensagem ignorada: fora do horário permitido (${msgHour}h. Permitido: ${startHour}h-${endHour}h).`);
                    return false;
                }
            }

            console.log(`${getTimestampLog()} [Newsletter] Validações aprovadas. Iniciando automação do PITMUNEWS.`);
            await handleAutomaticNews(message, client);
            return true;
        }
    } catch (error) {
        console.error(`${getTimestampLog()} [Newsletter] Erro:`, error.message);
    }
    return false;
}

module.exports = { handleNewsCommands };
