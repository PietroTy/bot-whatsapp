const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { exec } = require('child_process');

async function handleStickerFromQuote(message, client, onlySticker) {
    const quotedMessage = await message.getQuotedMessage();
    if (onlySticker) {
        if (quotedMessage.hasMedia && quotedMessage.type === 'image') {
            const media = await quotedMessage.downloadMedia();
            if (!media || !media.mimetype.startsWith("image")) {
                await message.reply("Isso não parece ser uma imagem compatível.");
                return;
            }
            const buffer = Buffer.from(media.data, 'base64');
            const webpBuffer = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp()
                .toBuffer();
            const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));
            await client.sendMessage(message.from, stickerMedia, {
                sendMediaAsSticker: true,
                stickerName: '',
                stickerAuthor: ''
            });
        } else {
            await message.reply("Neste grupo, apenas comandos de criação de figurinhas com imagens são permitidos.");
        }
        return;
    }
    try {
        const media = await quotedMessage.downloadMedia();
        if (quotedMessage.hasMedia && quotedMessage.type === 'image') {
            if (!media || !media.mimetype.startsWith("image")) {
                await message.reply("Isso não parece ser uma imagem compatível.");
                return;
            }
            const buffer = Buffer.from(media.data, 'base64');
            const webpBuffer = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp()
                .toBuffer();
            const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));
            await client.sendMessage(message.from, stickerMedia, {
                sendMediaAsSticker: true,
                stickerName: '',
                stickerAuthor: ''
            });
        }
    } catch {
        await message.reply("Erro ao processar a mensagem respondida.");
    }
}

async function handleStickerFromMedia(message, client) {
    try {
        const media = await message.downloadMedia();
        if (!media) {
            await message.reply("Erro ao baixar a mídia.");
            return;
        }
        const buffer = Buffer.from(media.data, 'base64');
        const mime = media.mimetype;
        const tempInputPath = path.join(__dirname, `../temp_input.${mime.includes("video") ? 'mp4' : 'png'}`);
        const tempOutputPath = path.join(__dirname, '../temp_output.webp');
        fs.writeFileSync(tempInputPath, buffer);

        if (mime.includes("image")) {
            await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp()
                .toFile(tempOutputPath);
        } else if (mime.includes("video")) {
            await new Promise((resolve, reject) => {
                const cmd = `ffmpeg -i "${tempInputPath}" -vf "fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -c:v libwebp -lossless 0 -qscale 75 -preset default -an -t 6 -loop 0 -y "${tempOutputPath}"`;
                exec(cmd, (err) => {
                    if (err) reject();
                    else resolve();
                });
            });
        } else {
            await message.reply("A mídia deve ser uma imagem ou vídeo curto.");
            return;
        }

        const webpBuffer = fs.readFileSync(tempOutputPath);
        const stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));
        await client.sendMessage(message.from, stickerMedia, {
            sendMediaAsSticker: true,
            stickerName: '',
            stickerAuthor: ''
        });

        fs.unlinkSync(tempInputPath);
        fs.unlinkSync(tempOutputPath);
    } catch {
        await message.reply("Falha ao transformar a mídia em figurinha.");
    }
}

module.exports = { handleStickerFromQuote, handleStickerFromMedia };