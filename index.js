// index.js
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { handleStickerCommands } = require('./handlers/stickerHandler');
const { handleNewsCommands } = require('./handlers/newsHandler');
const { handleBotCommands } = require('./handlers/botHandler');
const { handleTermoCommands } = require('./handlers/termoHandler');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/usr/bin/chromium',
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-infobars',
            '--disable-blink-features=AutomationControlled',
            '--remote-debugging-port=9222',
            '--window-size=800,600'
        ],
    },
    webVersionCache: {
        type: "none"
    }
});

client.on('qr', (qr) => {
    console.log('Escaneie o QR Code abaixo:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('Bot está ON e pronto!'));
client.on('authenticated', () => console.log('Bot autenticado!'));

client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação:', msg);
});

client.on('change_state', (state) => {
    console.log('Estado do bot mudou para:', state);
});

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
        if (await handleTermoCommands(message, client)) return;
        if (await handleBotCommands(message)) return;
    } catch (error) {
        console.error("Erro fatal no processamento da mensagem:", error);
    }
});

setInterval(async () => {
    try {
        await client.getState();
    } catch (err) {
        console.error("Cliente inativo, reiniciando...", err);
        client.initialize();
    }
}, 60 * 1000);

client.initialize();