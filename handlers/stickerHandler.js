// handlers/stickerHandler.js
const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
// use ffmpeg-static to avoid requiring a system-wide ffmpeg installation
let ffmpegPath;
try {
    ffmpegPath = require('ffmpeg-static');
} catch (e) {
    ffmpegPath = null;
}  

async function handleStickerCommands(message, client) {
    async function processMedia(media, from, originalMessage) {
        const id = crypto.randomBytes(4).toString('hex');
        const tempDir = path.join(__dirname, 'assets/tmp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempInputPath = path.join(tempDir, `input_${id}`);
        const tempOutputPath = path.join(tempDir, `output_${id}.webp`);
        let isVideoOrGif = false;

        try {
            if (!media) {
                await client.sendMessage(from, "Erro ao baixar a mídia.", { quotedMessageId: originalMessage.id._serialized });
                return;
            }

            const buffer = Buffer.from(media.data, 'base64');
            const mime = media.mimetype;

            const isImage = mime.startsWith('image') && !mime.includes('gif');
            isVideoOrGif = mime.startsWith('video') || mime.includes('gif');

            if (!(isImage || isVideoOrGif)) {
                await client.sendMessage(from, "A mídia deve ser uma imagem ou vídeo curto.", { quotedMessageId: originalMessage.id._serialized });
                return;
            }

            const inputExt = isVideoOrGif ? 'mp4' : 'png';
            fs.writeFileSync(`${tempInputPath}.${inputExt}`, buffer);

            if (isImage) {
                await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp()
                    .toFile(tempOutputPath);
            } else if (isVideoOrGif) {
                if (!ffmpegPath) {
                    throw new Error('ffmpeg binary not found. Install the ffmpeg package or add ffmpeg-static dependency.');
                }
                const cmd = `"${ffmpegPath}" -i "${tempInputPath}.${inputExt}" \
                -vf "fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512" \
                -c:v libwebp -lossless 1 -preset default -loop 0 -an -fps_mode passthrough -t 6 -y "${tempOutputPath}"`;
                await new Promise((resolve, reject) => {
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            console.error('Erro no FFmpeg:', stderr);
                            reject(err);
                        } else resolve();
                    });
                });
            }

            if (!fs.existsSync(tempOutputPath)) {
                throw new Error("A figurinha não foi gerada.");
            }

            const webpBuffer = fs.readFileSync(tempOutputPath);
            const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));

            await client.sendMessage(from, stickerMedia, {
                sendMediaAsSticker: true,
                stickerName: '',
                stickerAuthor: ''
            });
        } catch (err) {
            console.error('Erro ao criar figurinha:', err.message || err);
            let reply = "Falha ao transformar a mídia em figurinha, ela deve ter no `máximo 4 segundos`.";
            if (err.message && err.message.includes('ffmpeg binary not found')) {
                reply += "\n\nNão foi possível localizar o ffmpeg.";
            }
            await client.sendMessage(from, reply, { quotedMessageId: originalMessage.id._serialized });
        } finally {
            try {
                let inputExt;
                if (typeof isVideoOrGif === 'boolean') {
                    inputExt = isVideoOrGif ? 'mp4' : 'png';
                }
                if (inputExt) {
                    const inputFile = `${tempInputPath}.${inputExt}`;
                    if (fs.existsSync(inputFile)) {
                        fs.unlinkSync(inputFile);
                    }
                }
                if (fs.existsSync(tempOutputPath)) {
                    fs.unlinkSync(tempOutputPath);
                }
            } catch (err) {
                console.warn('Erro ao remover arquivos temporários:', err.message);
            }
        }
    }

    const text = message.body.trim().toLowerCase();
    const stickerTypos = [
        '#sticer', '#sticke', '#stickere', '#stiker', '#stikr', 
        '#stickr', '#stick', '#sicker', '#stckr', '#stickers', 
        '#stikere', '#stickee', '#stcker', '#ticker', '#ticke',
        '#tiker', '#ticer', '#stickerer', '#stikerr', '#estiquer',
        '#estiquere', '#stik'
    ];
    const chatJid = message.fromMe ? message.to : message.from;

    if (stickerTypos.includes(text)) {
        await message.reply('O BURRO, DIGITA DIREITO!');
        return true;
    }

    async function extractMediaFromMsgData(targetIdStr) {
        return await client.pupPage.evaluate(async (msgIdStr) => {
            let step = "Início";
            try {
                await new Promise(resolve => setTimeout(resolve, 1500));

                if (!msgIdStr) return { error: "ID da mensagem alvo não definido." };

                step = "Buscando targetMsg na Store";
                let targetMsg = window.Store.Msg.get(msgIdStr);
                if (!targetMsg) {
                    try {
                        step = "Buscando targetMsg via getMessagesById";
                        const fetched = await window.Store.Msg.getMessagesById([msgIdStr]);
                        targetMsg = fetched?.messages?.[0];
                    } catch (e) {
                        return { error: "Erro em getMessagesById(msgIdStr=" + msgIdStr + "): " + e.message };
                    }
                }

                if (!targetMsg) {
                    step = "Fallback StanzaID";
                    // Tenta achar varrendo os models carregados usando apenas o sufixo (StanzaID)
                    const stanzaId = msgIdStr.split('_').pop();
                    if (stanzaId) {
                        targetMsg = window.Store.Msg.getModelsArray().find(m => m.id && m.id.id === stanzaId);
                    }
                }

                if (!targetMsg) {
                    return { error: `A mensagem original não foi carregada. ID buscado: ${msgIdStr}` };
                }

                step = "Verificando mediaTypes";
                const mediaTypes = ['image', 'video', 'sticker', 'audio', 'ptt', 'document'];
                if (!mediaTypes.includes(targetMsg.type)) return { error: "A mensagem não é uma mídia suportada: " + targetMsg.type };

                if (targetMsg.mediaData && targetMsg.mediaData.mediaStage === 'REUPLOADING') {
                    return { error: "Mídia está expirada (REUPLOADING)" };
                }

                const getProp = (obj, prop) => obj && (obj[prop] !== undefined ? obj[prop] : obj['__x_' + prop]);

                const needsResolve = !targetMsg.mediaData || targetMsg.mediaData.mediaStage !== 'RESOLVED' || !getProp(targetMsg, 'filehash');
                
                if (needsResolve) {
                    step = "Resolvendo media";
                    try {
                        if (typeof targetMsg.downloadMedia === 'function') {
                            await targetMsg.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1 });
                        }
                    } catch (e) {
                        return { error: "Falha ao forçar o download: " + e.message };
                    }
                }

                step = "Extraindo propriedades";
                const directPath = getProp(targetMsg, 'directPath');
                const encFilehash = getProp(targetMsg, 'encFilehash');
                const filehash = getProp(targetMsg, 'filehash');
                const mediaKey = getProp(targetMsg, 'mediaKey');
                const mediaKeyTimestamp = getProp(targetMsg, 'mediaKeyTimestamp');
                const type = getProp(targetMsg, 'type');
                const mimetype = getProp(targetMsg, 'mimetype');
                const filename = getProp(targetMsg, 'filename');

                if (!directPath || !encFilehash || !filehash || !mediaKey) {
                    return { error: `Chaves ausentes. directPath:${!!directPath}, encFilehash:${!!encFilehash}, filehash:${!!filehash}, mediaKey:${!!mediaKey}` };
                }

                step = "Iniciando downloadAndMaybeDecrypt";
                let decryptedMedia;
                try {
                    const mockQpl = { addAnnotations: function() { return this; }, addPoint: function() { return this; } };
                    decryptedMedia = await window.Store.DownloadManager.downloadAndMaybeDecrypt({
                        directPath,
                        encFilehash,
                        filehash,
                        mediaKey,
                        mediaKeyTimestamp,
                        type,
                        signal: (new AbortController).signal,
                        downloadQpl: mockQpl
                    });
                } catch (e) {
                    return { error: "downloadAndMaybeDecrypt lançou erro: " + e.message + "\n" + e.name };
                }

                step = "Iniciando arrayBufferToBase64Async";
                try {
                    const data = await window.WWebJS.arrayBufferToBase64Async(decryptedMedia);
                    return { success: true, data, mimetype: mimetype, filename: filename || null };
                } catch (e) {
                    return { error: "arrayBufferToBase64Async lançou erro: " + e.message };
                }
            } catch (e) {
                return { error: `Erro inesperado no passo [${step}]: ` + e.message };
            }
        }, targetIdStr);
    }

    if (message.hasMedia && text === '#sticker') {
        const msgIdStr = message.id._serialized || (message.id ? `${message.id.fromMe ? 'true' : 'false'}_${message.id.remote._serialized || message.id.remote}_${message.id.id}` : null);
        const result = await extractMediaFromMsgData(msgIdStr);
        if (result && result.success) {
            const media = new MessageMedia(result.mimetype, result.data, result.filename);
            await processMedia(media, chatJid, message);
        } else {
            const erro = result ? result.error : "Desconhecido";
            await message.reply("Erro ao baixar a mídia: " + erro);
        }
        return true;
    }

    if (message.hasQuotedMsg && text === '#sticker') {
        let quotedIdStr = null;
        if (message._data && message._data.quotedStanzaID) {
            const isFromMe = message._data.quotedParticipant === client.info.wid._serialized;
            const remote = message._data.quotedParticipant || message.to;
            quotedIdStr = `${isFromMe ? 'true' : 'false'}_${remote}_${message._data.quotedStanzaID}`;
        } else if (message._data && message._data.quotedMsgObj) {
            const qid = message._data.quotedMsgObj.id;
            quotedIdStr = qid._serialized || `${qid.fromMe ? 'true' : 'false'}_${qid.remote._serialized || qid.remote}_${qid.id}`;
        }
        
        const result = await extractMediaFromMsgData(quotedIdStr);
        if (result && result.success) {
            const media = new MessageMedia(result.mimetype, result.data, result.filename);
            await processMedia(media, chatJid, message);
        } else {
            const erro = result ? result.error : "Desconhecido";
            await message.reply("Erro ao baixar a mídia da mensagem citada: " + erro);
        }
        return true;
    }

    if (text === '#link') {
        const groupLink = 'https://chat.whatsapp.com/KAg83JlOyWSGoHLBOLwrR8';
        const replyMessage = `*Link do nosso grupo:*\n\n${groupLink}`;
        await message.reply(replyMessage);
        return true;
    }

    return false;
}

module.exports = { handleStickerCommands };