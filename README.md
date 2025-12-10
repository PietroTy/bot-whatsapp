# Bot WhatsApp

Este bot automatiza o envio do jornal VINIMUNEWS para grupos do WhatsApp, além de oferecer comandos de IA, stickers, jogos de termo e utilidades. Ele é altamente configurável via arquivo `config/config.json`.

## Funcionalidades principais
- **Envio automático do jornal VINIMUNEWS** para grupos específicos, detectando mensagens do contato oficial.
- **Comandos de IA**: converse com o bot usando `#bot` ou peça ajuda com `#help`.
- **Criação de stickers**: envie uma imagem, vídeo curto ou gif com `#sticker`.
- **Jogos de termo**: jogue o tradicional termo e variações com comandos como `#termo`, `#dueto`, `#quarteto`, etc.
- **Configuração centralizada**: aniversariantes, grupos, delays e IDs são definidos em `config/config.json`.

## Passo a passo para rodar o bot

1. **Clone o repositório e instale as dependências:**
   ```bash
   git clone <repo-url>
   cd bot-whatsapp
   npm install
   ```

2. **Configure as chaves de API:**
   - Crie um arquivo `.env` na raiz com:
     ```env
     MARITACA_API_KEY="<sua-chave-maritaca>"
     YT_API_KEY="<sua-chave-youtube>"
     ```
   - A chave Maritaca é usada para a IA (chatbot). A chave do YouTube é opcional (para buscar vídeos).

3. **Edite o arquivo de configuração:**
   - Abra `config/config.json` e ajuste:
     - `newsletter.authorId`: ID do contato VINIMUNEWS (não é o número, é o ID do WhatsApp, ex: `231790962819089@lid`)
     - `newsletter.chatGroups`: nomes dos grupos que devem receber o jornal
     - `aniversariantes`: lista de aniversariantes (nome e data)
     - `ia.delayEntreParcelas`: delay entre requisições à IA (em ms)

4. **Execute o bot:**
   ```bash
   npm start
   ```
   - No primeiro uso, escaneie o QR Code no terminal com o WhatsApp Web.

## Bibliotecas principais utilizadas
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) – integração com WhatsApp Web
- [axios](https://github.com/axios/axios) – requisições HTTP
- [sharp](https://github.com/lovell/sharp) – processamento de imagens para stickers
- [dotenv](https://github.com/motdotla/dotenv) – variáveis de ambiente
- [openai](https://github.com/openai/openai-node) – integração com IA Maritaca
- [qrcode-terminal](https://github.com/gtanner/qrcode-terminal) – exibição de QR Code no terminal

## Estrutura de arquivos
- `index.js` – ponto de entrada do bot
- `handlers/` – lida com comandos de stickers, termo, bot e news
- `config/config.json` – todas as configurações do bot
- `.env` – chaves de API

## Observações
- O bot precisa rodar em ambiente com Node.js 18+ e Chromium instalado (ajuste o caminho em `index.js` se necessário).
- O ID do contato VINIMUNEWS pode ser obtido ativando o logger temporário ou analisando mensagens recebidas.
- O bot não envia mensagens de erro para o grupo, apenas loga no console.

---

Desenvolvido por PietroTy.
