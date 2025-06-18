// index.js
require('dotenv').config();
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { handleStickerCommands } = require('./handlers/stickerHandler');
const { handleNewsCommands } = require('./handlers/newsHandler');
const { handleBotCommands } = require('./handlers/botHandler');

const client = new Client({
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('Bot está ON!'));
client.on('authenticated', () => console.log('Bot autenticado!'));
client.on('disconnected', (reason) => {
    console.log('Bot desconectado:', reason);
    console.log('Tentando reconectar...');
    client.initialize();
});

client.on('message', async (message) => {
    if (!message.body || message.body.length < 2) return;
    try {
        if (await handleStickerCommands(message, client)) return;
        if (await handleNewsCommands(message, client)) return;
        if (await handleBotCommands(message)) return;
    } catch (error) {
        console.error("Erro fatal no processamento da mensagem:", error);
    }
});

client.initialize();