// services/aiService.js
require('dotenv').config();
const OpenAI = require("openai");

const client = new OpenAI({
    apiKey: process.env.MARITACA_API_KEY,
    baseURL: "https://chat.maritaca.ai/api"
});

/**
 * @param {Array<Object>} messages
 * @returns {Promise<string>}
 */
async function perguntarIA(messages) {
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