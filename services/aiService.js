// services/aiService.js
require('dotenv').config();
const OpenAI = require("openai");

const API_KEY = process.env.MARITACA_API_KEY;

let client = null;
let iaEnabled = false;

if (API_KEY) {
    client = new OpenAI({
        apiKey: API_KEY,
        baseURL: "https://chat.maritaca.ai/api"
    });
    iaEnabled = true;
} else {
    console.warn("Aviso: MARITACA_API_KEY não definida. Funcionalidades de IA ficarão desativadas.");
}

/**
 * @param {Array<Object>} messages
 * @returns {Promise<string>}
 */
async function perguntarIA(messages) {
    if (!iaEnabled) {
        return "O serviço de IA não está configurado neste servidor.";
    }

    try {
        const response = await client.chat.completions.create({
            model: "sabiazim-3",
            messages: messages,
            temperature: 0.7,
            max_tokens: 1500
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error("Erro ao chamar a API da IA:", error.response?.data || error.message);
        throw new Error("Falha na comunicação com a IA.");
    }
}

module.exports = { perguntarIA };