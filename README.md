# Verlic Zap AI

Sistema de WhatsApp com Inteligência Artificial usando DeepSeek, Evolution API e Next.js.

## Funcionalidades

- 🤖 **Respostas automáticas com IA** - DeepSeek para geração de respostas contextuais
- 📱 **Múltiplas instâncias WhatsApp** - Conecte vários números simultaneamente
- 👥 **Números autorizados** - Controle quem pode interagir com o bot
- 📊 **Métricas e analytics** - Acompanhe mensagens, requisições e erros
- 🔒 **Autenticação segura** - Login com sessões JWT
- 🎨 **Interface dark mode** - Design moderno e responsivo

## Requisitos

- Node.js 18+
- PostgreSQL
- Redis (opcional, mas recomendado)
- Evolution API (para WhatsApp)
- API Key do DeepSeek

## Setup Rápido

### 1. Clone e instale

```bash
git clone https://github.com/pedrostyxx/verlic-zap-ai.git
cd verlic-zap-ai
npm install
```

### 2. Configure as variáveis de ambiente

Copie o arquivo de exemplo e configure suas credenciais:

```bash
cp .env.example .env
```

Edite o `.env` com suas configurações:

```env
# PostgreSQL Database (obrigatório)
DATABASE_URL="postgres://usuario:senha@host:5432/database"

# Redis (recomendado)
REDIS_URL="redis://default:senha@host:6379"

# Evolution API (obrigatório para WhatsApp)
EVOLUTION_API_URL="http://localhost:8080"
EVOLUTION_API_KEY="sua_chave"

# DeepSeek AI (obrigatório para respostas IA)
DEEPSEEK_API_KEY="sua_chave_deepseek"

# JWT Secret (obrigatório - gere uma string segura)
JWT_SECRET="sua_chave_jwt_muito_segura"
```

### 3. Configure o banco de dados

```bash
npx prisma db push
```

### 4. Inicie a aplicação

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

### 5. Acesse o sistema

Abra [http://localhost:3000](http://localhost:3000)

**Credenciais padrão:**
- Email: `admin@verlic.ai`
- Senha: `admin123`

## Configuração da Evolution API

1. Configure o webhook na Evolution API apontando para:
   ```
   https://seu-dominio.com/api/webhook/evolution
   ```

2. Eventos necessários:
   - `MESSAGES_UPSERT`
   - `CONNECTION_UPDATE`
   - `QRCODE_UPDATED`

## Deploy em Produção

### Variáveis de ambiente necessárias

```env
DATABASE_URL=
REDIS_URL=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
DEEPSEEK_API_KEY=
JWT_SECRET=
NEXTAUTH_URL=https://seu-dominio.com
NODE_ENV=production
```

### Docker (opcional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Estrutura do Projeto

```
src/
├── app/
│   ├── api/              # Rotas da API
│   ├── dashboard/        # Páginas do painel
│   └── login/            # Página de login
├── components/
│   ├── layout/           # Componentes de layout
│   └── ui/               # Componentes reutilizáveis
└── lib/
    ├── auth.ts           # Autenticação
    ├── deepseek.ts       # Integração DeepSeek
    ├── evolution.ts      # Integração Evolution API
    ├── metrics.ts        # Sistema de métricas
    ├── prisma.ts         # Cliente Prisma
    └── redis.ts          # Cliente Redis
```

## Licença

MIT
