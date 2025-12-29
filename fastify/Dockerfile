FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Test image ---
FROM builder AS test

ENV NODE_ENV=test

COPY jest.config.ts ./
CMD ["npm", "test"]

# --- Production image ---
FROM node:24-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3002

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/server.js"]
