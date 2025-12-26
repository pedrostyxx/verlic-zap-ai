const { defineConfig } = require('prisma/config')

// Carrega variáveis de ambiente
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL não está definida')
}

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: DATABASE_URL || 'postgresql://localhost:5432/placeholder',
  },
})
