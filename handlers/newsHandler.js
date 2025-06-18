// handlers/newsHandler.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { perguntarIA } = require('../services/aiService');

const chatWithNewsletter = ["T . D . A . P .", "Q Cremosidade"];
const COUNTER_FILE = path.join(__dirname, '../pitmunews_counter.json');

function getEditionNumber() {
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
            return data.edition || 1;
        }
    } catch {  }
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
        const freeGames = elements.filter(game => {
            const isFree = game.price?.totalPrice?.discountPrice === 0;
            const isFreeCategory = game.categories?.some(category => category.path === 'freegames');
            return isFree && isFreeCategory;
        });
        return freeGames.map(game => game.title);
    } catch (error) {
        console.error("Erro ao buscar jogos grátis na Epic Games:", error.message);
        return [];
    }
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    console.warn(`Texto do editor truncado de ${text.length} para ${maxLength} caracteres.`);
    return text.slice(0, maxLength);
}


function getPromptTemplate() {
    return `
Você é um editor-chefe de um jornal digital chamado PITMUNEWS. Sua tarefa é receber o texto bruto de um jornal parceiro (VINIMUNEWS) e uma lista de jogos grátis, e criar uma nova edição do seu próprio jornal.

**REGRAS GERAIS OBRIGATÓRIAS:**

1.  **REGRA DE OURO - MANCHETE DE ANIVERSÁRIO:** Se a data do jornal corresponder a uma das datas na lista de 'Aniversários Especiais' (ver seção 4), a PRIMEIRA manchete do dia DEVE ser uma celebração sobre o aniversariante. Escreva em um tom pessoal e comemorativo.
2.  **SELEÇÃO E DETALHE:** Tente selecionar até 3 das notícias mais importantes para cada tópico do VINIMUNEWS. Se não houver notícias relevantes, menos é aceitável. Resuma as informações, mas forneça detalhes suficientes (cerca de 2-3 frases) para que o leitor entenda o contexto.
3.  **LIMPEZA:** IGNORE COMPLETAMENTE e não inclua no seu jornal: pedidos de PIX, chaves de celular, links de redes sociais, hashtags, frases repetidas, listas de santos, anjos, aniversários de municípios e a "Frase do Dia".
4.  **EMOJIS:** Use emojis de forma inteligente para separar seções e, obrigatoriamente, antes de CADA item de notícia e CADA indicador chave.

**ESTRUTURA E FORMATO DO PITMUNEWS (SIGA EXATAMENTE):**

---
**1. CABEÇALHO:**
   - Formato: 📰 PITMUNEWS – Ano 1, Nº \${editionNumber} 🗞
   - Local: 📍 De SJBV-SP / SP-SP
   - Data: Extraia do VINIMUNEWS.

**2. SEÇÃO "MANCHETES DO DIA":**
   - Lembre-se da "REGRA DE OURO" para a primeira manchete em dias de aniversário.
   - Escolha os 3 eventos mais impactantes do dia e escreva uma frase de impacto para cada.

**3. SEÇÃO "UTILIDADES DO DIA":**
   - *Dia do Ano:* Extraia o número do dia do ano.
   - *Fase da Lua:* Extraia a fase da lua e a porcentagem de visibilidade.
   - *Tempo em SP:* Encontre a previsão para "SÃO PAULO/SP" e a formate de forma curta.
   - *Hoje é dia de:* Liste os itens mais interessantes da seção "HOJE É DIA...", cada um em uma nova linha e começando com um emoji temático.
   - *Horóscopo:* Faça um resumo MUITO CURTO do horóscopo do signo vigente.
   - *Indicadores Chave:* Extraia os valores de Dólar, Euro, Ibovespa, Bitcoin e Selic. Formate em uma única linha, com um emoji temático antes de cada um.

**4. SEÇÃO "ANIVERSARIANTE DO DIA" (OPCIONAL):**
   - **REGRA CONDICIONAL:** Esta seção SÓ DEVE APARECER se a data do jornal corresponder a uma das datas na lista abaixo. A data na lista está no formato 'DIA/MÊS'.
   - *Lista de Aniversários:* (1/9 Pietro e Vitor, 4/6 Lais, 19/5 Pedro)
   - Se a condição for atendida, use o título "🎂 Nosso(s) Aniversariante(s) do Dia!" e escreva uma pequena mensagem pessoal e calorosa de parabéns.

**5. SEÇÃO "BOLA DA VEZ":**
   - **🎮 GAMES:**
     - **Instrução para Jogo Grátis:** Verifique a seção 'JOGOS GRÁTIS DA EPIC GAMES HOJE' no final do prompt. Se houver jogos, anuncie-os de forma destacada no início desta seção (ex: 🎁 **Grátis na Epic:** Nome do Jogo). Se a lista disser 'Nenhum', não mencione nada sobre jogos grátis.
     - **Notícias:** Escolha até 3 notícias da seção "GAMES" do texto do VINIMUNEWS. Resuma cada uma em um parágrafo curto, começando com um emoji.
   - **💻 TECNOLOGIA:** Tente incluir até 3 notícias. Resuma em um parágrafo curto, começando com um emoji.

**6. SEÇÃO "DESTAQUES DE NOTÍCIAS":**
   - Tente incluir até 3 notícias para cada categoria.
   - **🏛️ POLÍTICA:** Selecione notícias sobre governo, Congresso, judiciário e decisões políticas importantes.
   - **🏥 SAÚDE & MEIO AMBIENTE:** Procure por notícias sobre saúde, bem-estar, ciência médica, sustentabilidade e questões ambientais.
   - **💰 ECONOMIA & MERCADO:** Use a seção "ECONOMIA".
   - **⚽ ESPORTES:** Use a seção "ESPORTES".

**7. SEÇÃO "FILMES & SÉRIES":**
   - 🎬 Procure por 1 ou 2 notícias relevantes sobre filmes, séries ou a indústria do entretenimento e resuma-as aqui.

**8. RODAPÉ:**
   - Finalize com o seguinte bloco de texto EXATO, preservando a formatação e os emojis:
     📨 Você está lendo *PITMUNEWS*
     🧠 Criado com: TogetherAI, VINIMUNEWS e News API
     🤖 Distribuído automaticamente pelo Botzin do ZipZop
---

**CONTEXTO FORNECIDO PARA O JORNAL DE HOJE:**

---
**TEXTO BRUTO DO VINIMUNEWS:**
\${textoCompletoDoEditor}
---
**JOGOS GRÁTIS DA EPIC GAMES HOJE:**
\${jogosGratisEpic}
`;
}



async function handleAutomaticNews(message, client) {
    try {
        const editionNumber = incrementEditionNumber();
        const textoCompletoDoEditor = message.body;

        const textoTruncado = truncateText(textoCompletoDoEditor, 12000);

        const freeGames = await fetchEpicFreeGames();
        let freeGamesText = "Nenhum jogo grátis encontrado hoje.";
        if (freeGames && freeGames.length > 0) {
            freeGamesText = freeGames.join('\n');
        }
        
        const promptTemplate = getPromptTemplate();
        const finalPrompt = promptTemplate
            .replace('${editionNumber}', editionNumber)
            .replace('${textoCompletoDoEditor}', textoTruncado)
            .replace('${jogosGratisEpic}', freeGamesText);
        
        const jornal = await perguntarIA([
            { role: "system", content: "Você é um assistente de redação de jornal automatizado." },
            { role: "user", content: finalPrompt }
        ]);

        if (jornal.toLowerCase().includes("erro no jornal")) {
            console.warn("Geração do jornal abortada pela IA. O texto do editor pode estar vazio ou ser insuficiente.");
            await message.reply("Não foi possível gerar o jornal. O texto de origem parece estar vazio ou incompleto.");
            return;
        }

        const allChats = await client.getChats();
        const targetGroups = allChats.filter(c => c.isGroup && chatWithNewsletter.includes(c.name));

        if (targetGroups.length > 0) {
            for (const group of targetGroups) {
                await client.sendMessage(group.id._serialized, jornal);
                
                const stickerPath = path.join(__dirname, '../Newsletter.webp');
                if (fs.existsSync(stickerPath)) {
                    const stickerMedia = MessageMedia.fromFilePath(stickerPath);
                    await client.sendMessage(group.id._serialized, stickerMedia, { sendMediaAsSticker: true });
                }
            }
        } else {
            await message.reply("Jornal gerado, mas nenhum grupo de destino foi encontrado.");
        }
    } catch (error) {
        console.error("Erro ao gerar jornal automático:", error);
        const errorMessage = error.response?.data?.error?.message || error.message;
        await message.reply(`Ocorreu um erro ao tentar gerar ou enviar o jornal. Detalhe: ${errorMessage}`);
    }
}

/**
 * @param {import('whatsapp-web.js').Message} message
 * @param {import('whatsapp-web.js').Client} client 
 * @returns {Promise<boolean>} 
 */
async function handleNewsCommands(message, client) {
    const contact = await message.getContact();
    if (contact.name === "Newsletter") {
        await handleAutomaticNews(message, client);
        return true;
    }
    return false;
}

module.exports = { handleNewsCommands };