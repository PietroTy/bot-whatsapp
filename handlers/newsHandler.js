// handlers/newsHandler.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { perguntarIA } = require('../services/aiService');

const chatWithNewsletter = ["T . D . A . P .", "Laranja Cremosa"];
const COUNTER_FILE = path.join(__dirname, '../pitmunews_counter.json');

const ANIVERSARIANTES_ESPECIAIS = [
    { nome: 'Luiz', data: '27/01' },
    { nome: 'Pedrin', data: '08/02' },
    { nome: 'Liz', data: '09/02' },
    { nome: 'Laila', data: '17/02' },
    { nome: 'Dani', data: '03/03' },
    { nome: 'Roger', data: '07/03' },
    { nome: 'Xivana', data: '21/03' },
    { nome: 'Mel', data: '13/04' },
    { nome: 'Lidi', data: '21/05' },
    { nome: 'Evelyn', data: '08/06' },
    { nome: 'Nic', data: '08/06' },
    { nome: 'Felipinho', data: '09/06' },
    { nome: 'Xumas', data: '19/06' },
    { nome: 'Mary', data: '21/06' },
    { nome: 'Raissa', data: '26/06' },
    { nome: 'Gregorio', data: '05/07' },
    { nome: 'Bia', data: '13/07' },
    { nome: 'Pietro', data: '01/09' },
    { nome: 'Vito', data: '01/09' },
    { nome: 'Kevin', data: '22/09' },
    { nome: 'Layzer', data: '04/11' },
    { nome: 'Rebs', data: '24/11' },
    { nome: 'Casari', data: '17/12' },
    { nome: 'Heitor', data: '17/12' },
    { nome: 'Fernando', data: '16/12' },
    { nome: 'SrQuirino', data: '19/12' },
    { nome: 'Tirado', data: '26/12' },
    { nome: 'Marcola', data: '28/12' },
    { nome: 'Rogréio', data: '29/12' }
];

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
- Para títulos de seção (ex: "HOJE É DIA...", "UTILIDADES"), use os emojis originais do texto-fonte.
- **NUNCA use asteriscos \`*\` para formatar títulos.** Deixe os títulos limpos.

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
- Sua função é replicar a formatação original do VINIMUNEWS para as notícias.
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

**REGRAS DE FORMATAÇÃO:**
- Extraia APENAS as manchetes que já estiverem no texto abaixo.
- Mantenha os emojis originais no início de cada manchete.
- NÃO adicione manchetes novas.
- NÃO use asteriscos.
- Remova fontes no final da linha, se houver (ex: "(CNN)", "(POD360)", etc).
- Para cada manchete, escreva uma linha independente com o emoji no início.
- Comece cada seção com seu título em destaque, decorado com emojis antes e depois. Exemplo:
  💓 SAÚDE 💓
  🧪 TECNOLOGIA & CIÊNCIA 🧪
  🎮 GAMES 🎮

- Em GAMES, ao final da lista de manchetes, adicione esta linha com os jogos grátis:
🎁 Grátis na Epic: ${jogosGratis}

**TEXTO ORIGINAL:**
\`\`\`
${textoNoticias2}
\`\`\`
`;
}

function getPromptParte4(textoNoticias2) {
    return `
Você é um editor de jornal digital (PITMUNEWS). Sua tarefa é criar a parte de **ECONOMIA, ESPORTES E ENTRETENIMENTO**.

**REGRAS DE FORMATAÇÃO:**
- Extraia APENAS as manchetes dessas seções que já estiverem no texto abaixo.
- Mantenha os emojis originais no início de cada manchete.
- NÃO adicione novas manchetes.
- NÃO use asteriscos.
- Remova fontes no final da linha (ex: "(CNN)").
- Comece cada seção com seu título em destaque, com emojis antes e depois. Exemplo:
  💰 ECONOMIA 💰
  🏆 ESPORTES 🏆
  🌟 FAMA & ENTRETENIMENTO 🌟

- Em ECONOMIA, ao final da seção, adicione:
📊 Indicadores: Dólar [valor] [emoji] | Euro [valor] [emoji] | Bitcoin [valor] [emoji] | Petróleo [valor] [emoji]

- Finalize seu texto com este rodapé **EXATO**:

📨 Você está lendo PITMUNEWS  
🧠 Criado com: TogetherAI, VINIMUNEWS e APIs  
🤖 Distribuído automaticamente pelo Botzin do ZipZop

**TEXTO ORIGINAL:**
\`\`\`
${textoNoticias2}
\`\`\`
`;
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
            await message.reply("Falha ao processar: a estrutura do VINIMUNEWS não pôde ser reconhecida. Verifique os marcadores de seção.");
            return;
        }
        console.log("Jornal dividido em 4 partes com sucesso.");

        const editionNumber = incrementEditionNumber();
        const freeGames = await fetchEpicFreeGames();
        let freeGamesText = "Nenhum jogo grátis encontrado hoje.";
        if (freeGames.length > 0) {
            freeGamesText = freeGames.join(' | ');
        }

        const prompt1 = getPromptParte1(partes.introducao, editionNumber);
        const prompt2 = getPromptParte2(partes.secaoNoticias1);
        const prompt3 = getPromptParte3(partes.secaoNoticias2, freeGamesText);

        const systemMessage = { role: "system", content: "Você é um assistente de redação de jornal automatizado, focado em seguir instruções precisamente para criar seções de um jornal." };

        console.log("Enviando Parte 1 para a IA...");
        const resultadoParte1 = await perguntarIA([systemMessage, { role: "user", content: prompt1 }]);

        console.log("Aguardando 12 segundos para evitar rate limit...");
        await delay(12000);

        console.log("Enviando Parte 2 para a IA...");
        const resultadoParte2 = await perguntarIA([systemMessage, { role: "user", content: prompt2 }]);

        console.log("Aguardando 12 segundos para evitar rate limit...");
        await delay(12000);

        console.log("Enviando Parte 3 para a IA...");
        const resultadoParte3 = await perguntarIA([systemMessage, { role: "user", content: getPromptParte3(partes.secaoNoticias2, freeGamesText) }]);

        console.log("Aguardando 12 segundos para evitar rate limit...");
        await delay(12000);

        console.log("Enviando Parte 4 para a IA...");
        const resultadoParte4 = await perguntarIA([systemMessage, { role: "user", content: getPromptParte4(partes.secaoNoticias3) }]);

        console.log("Todas as partes recebidas da IA.");
        
        const jornalGerado = [resultadoParte1, resultadoParte2, resultadoParte3, resultadoParte4].join('\n\n');
        const jornalCompleto = mensagemAniversario + jornalGerado;

        const allChats = await client.getChats();
        const targetGroups = allChats.filter(c => c.isGroup && chatWithNewsletter.includes(c.name));

        if (targetGroups.length > 0) {
            console.log(`Enviando PITMUNEWS Nº ${editionNumber} para ${targetGroups.length} grupo(s).`);
            for (const group of targetGroups) {
                await client.sendMessage(group.id._serialized, jornalCompleto);
            }
            const stickerPath = path.join(__dirname, '../Newsletter.webp');
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
        await message.reply(`Ocorreu um erro crítico ao gerar ou enviar o jornal. Detalhe: ${errorMessage}`);
    }
}

async function handleNewsCommands(message, client) {
    const contact = await message.getContact();
    if (contact.name === "Newsletter") {
        await handleAutomaticNews(message, client);
        return true;
    }
    return false;
}

module.exports = { handleNewsCommands };