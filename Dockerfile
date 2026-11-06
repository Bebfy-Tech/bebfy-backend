# 1. Estágio de Compilação (Builder)
FROM node:20-alpine AS builder

# Instala bibliotecas necessárias para o Prisma no Alpine Linux
RUN apk add --no-cache openssl libc6-compat

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps

COPY . .

# Gera o Prisma Client com suporte nativo ao Alpine Linux
RUN npx prisma generate
RUN npm run build

# --- Estágio 2: Produção ---
FROM node:20-alpine AS production

# Instala bibliotecas de execução OpenSSL/Prisma no ambiente final
RUN apk add --no-cache openssl libc6-compat

WORKDIR /usr/src/app

COPY package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

# Executa as migrations/schema no PostgreSQL e inicializa o NestJS
CMD ["sh", "-c", "npx prisma db push && if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]