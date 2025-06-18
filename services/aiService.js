// services/aiService.js
const axios = require('axios');
require('dotenv').config();

/**
 * @param {Array<Object>} messages
 * @returns {Promise<string>}
 */
async function perguntarIA(messages) {
    const apiKey = process.env.TOGETHER_API_KEY;
    const payload = {
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500
    };
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    try {
        const response = await axios.post(
            "https://api.together.xyz/v1/chat/completions",
            payload,
            { headers }
        );
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error("Erro ao chamar a API da IA:", error.response ? error.response.data : error.message);
        throw new Error("Falha na comunicação com a IA.");
    }
}

module.exports = { perguntarIA };