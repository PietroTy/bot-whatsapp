const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

async function handleNewsletter(message, client, chatWithNewsletter, incrementEditionNumber, perguntarIA) {
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
}

module.exports = { handleNewsletter };