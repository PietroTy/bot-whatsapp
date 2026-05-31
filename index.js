// index.js
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { handleStickerCommands } = require('./handlers/stickerHandler');
const { handleNewsCommands } = require('./handlers/newsHandler');
const { handleBotCommands } = require('./handlers/botHandler');
const { handleTermoCommands } = require('./handlers/termoHandler');
const { version } = require('./package.json');

let client;
let isRestarting = false;

function cleanLockFiles() {
    const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session');
    const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
    for (const file of lockFiles) {
        const filePath = path.join(sessionPath, file);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`[Setup] Removido arquivo de trava antigo: ${file}`);
            } catch (err) {
                console.error(`[Setup] Erro ao remover ${file}:`, err.message);
            }
        }
    }
}

async function getLatestWAHTMLVersion() {
    try {
        console.log('[Setup] Buscando a versão mais recente do WhatsApp Web...');
        const response = await axios.get('https://api.github.com/repos/wppconnect-team/wa-version/contents/html', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });
        const files = response.data;
        const htmlFiles = files
            .filter(f => f.name && f.name.endsWith('.html'))
            .map(f => f.name);
        
        if (htmlFiles.length > 0) {
            htmlFiles.sort();
            const latest = htmlFiles[htmlFiles.length - 1];
            console.log(`[Setup] Versão encontrada no repositório: ${latest}`);
            return latest;
        }
    } catch (err) {
        console.error('[Setup] Erro ao buscar versão mais recente do WA:', err.message);
    }
    // Fallback para quando a API falhar ou der rate limit
    const fallback = '2.3000.1040491295-alpha.html';
    console.log(`[Setup] Usando versão fallback segura: ${fallback}`);
    return fallback;
}

async function createClient() {
    const latestHtml = await getLatestWAHTMLVersion();
    const remotePath = `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${latestHtml}`;
    console.log(`[Setup] Configurando remotePath: ${remotePath}`);
    
    client = new Client({
        authStrategy: new LocalAuth(),
        webVersionCache: {
            type: 'remote',
            remotePath: remotePath,
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
}

async function safeInitialize() {
    if (isRestarting) return;
    isRestarting = true;
    let attempts = 0;
    while (attempts < 5) {
        try {
            console.log(`[Setup] Inicializando cliente (tentativa ${attempts + 1}/5)...`);
            if (client) {
                try {
                    await client.destroy();
                } catch (e) {
                    // Ignora
                }
            }
            
            // Limpa travas antigas que impedem a inicialização
            cleanLockFiles();
            
            // Cria o novo cliente com a versão do WA atualizada
            await createClient();
            
            await client.initialize();
            console.log('[Setup] Cliente inicializado com sucesso!');
            break; // sucesso
        } catch (err) {
            attempts++;
            console.error(`[Setup] Erro ao inicializar (tentativa ${attempts}/5):`, err.message);
            
            if (client) {
                try {
                    await client.destroy();
                } catch (destroyErr) {
                    // Ignora
                }
            }
            
            if (attempts < 5) {
                console.log('[Setup] Aguardando 5s antes de tentar novamente...');
                await new Promise(r => setTimeout(r, 5000));
            } else {
                console.error('[Setup] Máximo de tentativas atingido. Encerrando processo.');
                process.exit(1);
            }
        }
    }
    isRestarting = false;
}

setInterval(async () => {
    if (isRestarting || !client) return;
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
