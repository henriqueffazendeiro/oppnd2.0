# Gmail Read Receipts Extension

Uma extensão para Chrome que adiciona ticks de leitura ao Gmail, similares aos do WhatsApp.

## Funcionalidades

- 🔵 **1 Tick Cinzento**: Emails enviados antes da extensão estar ativa
- 🔵🔵 **2 Ticks Cinzentos**: Email enviado com a extensão ativa
- 🟢🟢 **2 Ticks Verdes**: Email foi aberto pelo destinatário

## Como Instalar

### 1. Instalar a Extensão

1. Faça download ou clone este repositório
2. Abra o Chrome e vá para `chrome://extensions/`
3. Ative o "Modo do desenvolvedor" no canto superior direito
4. Clique em "Carregar extensão sem compactação"
5. Selecione a pasta `gmail-read-receipts`

### 2. Configurar o Servidor (Vercel)

1. Instale a Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Faça login na Vercel:
   ```bash
   vercel login
   ```

3. Faça deploy do servidor:
   ```bash
   vercel --prod
   ```

4. Atualize o arquivo `content.js` e `manifest.json` com o URL do seu domínio Vercel

### 3. Atualizar URLs

No arquivo `content.js`, linha 4:
```javascript
this.API_BASE = 'https://SEU-DOMINIO.vercel.app/api';
```

No arquivo `manifest.json`, adicione seu domínio:
```json
"host_permissions": [
  "https://mail.google.com/*",
  "https://SEU-DOMINIO.vercel.app/*"
]
```

## Como Usar

1. Abra o Gmail
2. Clique no ícone da extensão para ativar/desativar o rastreamento
3. Envie emails - os ticks aparecerão automaticamente nos emails enviados
4. Os ticks ficarão verdes quando o destinatário abrir o email

## Estrutura do Projeto

```
gmail-read-receipts/
├── manifest.json          # Manifesto da extensão Chrome
├── content.js            # Script que modifica o Gmail
├── background.js         # Service worker da extensão
├── popup.html           # Interface da extensão
├── popup.js             # Lógica da interface
├── styles.css           # Estilos dos ticks
├── api/
│   ├── track/[emailId].js    # API para rastrear aberturas
│   ├── email-status/[emailId].js  # API para consultar status
│   └── email.js              # API para armazenar emails
├── package.json
├── vercel.json
└── README.md
```

## Limitações Atuais

- O sistema de armazenamento usa uma implementação simples (adequado para demonstração)
- Para produção, recomenda-se usar um banco de dados real (Redis, MongoDB, etc.)
- Funciona apenas com emails HTML (a maioria dos emails modernos)

## Melhorias Futuras

- Integração com banco de dados real
- Notificações quando emails são lidos
- Estatísticas de abertura de emails
- Suporte para emails em texto simples

## Aviso Legal

Esta extensão é apenas para fins educacionais e de demonstração. O rastreamento de emails deve ser usado de forma ética e em conformidade com as leis de privacidade aplicáveis.