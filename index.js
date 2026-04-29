// index.js
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { handleStickerCommands } = require('./handlers/stickerHandler');
const { handleNewsCommands } = require('./handlers/newsHandler');
const { handleBotCommands } = require('./handlers/botHandler');
const { handleTermoCommands } = require('./handlers/termoHandler');
const { version } = require('./package.json');

let isRestarting = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1017054420-alpha.html',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
    }
});

async function safeInitialize() {
    if (isRestarting) return;
    isRestarting = true;
    let attempts = 0;
    while (attempts < 5) {
        try {
            await client.initialize();
            break; // sucesso
        } catch (err) {
            attempts++;
            console.error(`Erro ao inicializar (tentativa ${attempts}/5):`, err.message);
            if (attempts < 5) {
                console.log('Aguardando 5s antes de tentar novamente...');
                await new Promise(r => setTimeout(r, 5000));
            } else {
                console.error('Máximo de tentativas atingido. Encerrando processo.');
                process.exit(1);
            }
        }
    }
    isRestarting = false;
}

client.on('qr', (qr) => {
    console.log('Escaneie o QR Code abaixo:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log(`Bot v${version} está ON e pronto!`));
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
});

client.on('message_create', async (message) => {
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
    if (isRestarting) return;
    try {
        const state = await client.getState();
        if (!state) throw new Error("Sem estado");
    } catch (err) {
        console.log("Cliente caiu — reiniciando sessão...");
        try {
            await client.destroy();
        } catch {}
        safeInitialize();
    }
}, 60 * 1000);

// Impede que erros não tratados do puppeteer/whatsapp-web matem o processo
process.on('unhandledRejection', (reason) => {
    console.error('Rejeição não tratada capturada (processo protegido):', reason?.message ?? reason);
});

safeInitialize();
