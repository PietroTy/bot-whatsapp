// handlers/stickerHandler.js
const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

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
                await originalMessage.reply("Erro ao baixar a mídia.");
                return;
            }

            const buffer = Buffer.from(media.data, 'base64');
            const mime = media.mimetype;

            const isImage = mime.startsWith('image') && !mime.includes('gif');
            isVideoOrGif = mime.startsWith('video') || mime.includes('gif');

            if (!(isImage || isVideoOrGif)) {
                await originalMessage.reply("A mídia deve ser uma imagem ou vídeo curto.");
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
                const cmd = `ffmpeg -i "${tempInputPath}.${inputExt}" \
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
            await originalMessage.reply("Falha ao transformar a mídia em figurinha, ela deve ter no `máximo 4 segundos`.");
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

    if (message.hasMedia && message.body.trim().toLowerCase() === '#sticker') {
        const media = await message.downloadMedia();
        await processMedia(media, message.from, message);
        return;
    }

    if (message.hasQuotedMsg && message.body.trim().toLowerCase() === '#sticker') {
        const quotedMsg = await message.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const media = await quotedMsg.downloadMedia();
            await processMedia(media, message.from, message);
            return;
        }
    }

    if (message.body.trim().toLowerCase() === '#link') {
        const groupLink = 'https://chat.whatsapp.com/KAg83JlOyWSGoHLBOLwrR8';
        const replyMessage = `*Link do nosso grupo:*\n\n${groupLink}`;
        await message.reply(replyMessage);
    }
}

module.exports = { handleStickerCommands };