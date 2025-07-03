// handlers/stickerHandler.js
const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

async function handleStickerCommands(message, client) {
    if (message.hasMedia && message.body.trim() === '#sticker') {
        const randomId = crypto.randomBytes(4).toString('hex');
        const tempDir = path.join(__dirname, 'tmp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const tempInputPath = path.join(tempDir, `input_${randomId}`);
        const tempOutputPath = path.join(tempDir, `output_${randomId}.webp`);
        let isVideoOrGif = false;

        let creationError = false;

        try {
            const media = await message.downloadMedia();
            if (!media) {
                await message.reply("Erro ao baixar a mídia.");
                return;
            }

            const buffer = Buffer.from(media.data, 'base64');
            const mimeType = media.mimetype;

            const isImage = mimeType.startsWith('image') && !mimeType.includes('gif');
            isVideoOrGif = mimeType.startsWith('video') || mimeType.includes('gif');

            if (!(isImage || isVideoOrGif)) {
                await message.reply("A mídia deve ser uma imagem ou vídeo curto.");
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
                const ffmpegCmd = `ffmpeg -i "${tempInputPath}.${inputExt}" -vf "fps=15,scale=512:-1,crop=512:512" -c:v libwebp -lossless 1 -preset default -loop 0 -an -vsync 0 -t 6 -y "${tempOutputPath}"`;
                await new Promise((resolve, reject) => {
                    exec(ffmpegCmd, (err, stdout, stderr) => {
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

            await message.reply(stickerMedia, undefined, {
                sendMediaAsSticker: true,
                stickerName: '',
                stickerAuthor: ''
            });
        } catch (err) {
            creationError = true;
            console.error('Erro ao criar figurinha:', err.message || err);
        } finally {
            try {
                fs.unlinkSync(`${tempInputPath}.${isVideoOrGif ? 'mp4' : 'png'}`);
                if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            } catch (err) {
                console.warn('Erro ao remover arquivos temporários:', err.message);
            }
            if (creationError) {
                await message.reply("❌ Falha ao transformar a mídia em figurinha. Tente outra ou reduza o tamanho/duração.");
            }
        }
    }

    if (message.body.trim().toLowerCase() === '#link') {
        const groupLink = 'https://chat.whatsapp.com/KAg83JlOyWSGoHLBOLwrR8';
        const replyMessage = `*Link do nosso grupo:*\n\n${groupLink}`;
        await message.reply(replyMessage);
    }
}

module.exports = { handleStickerCommands };