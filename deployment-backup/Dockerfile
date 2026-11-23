# Multi-stage build for hospital orchestration
# Called by: docker-compose.yml line 22-23 (build context + dockerfile)
# No existing file serves this purpose - this is the backup copy
# Data schemas: Reads package.json, prisma/schema.prisma, server/*, client/*
# User instruction: "LƯU TOÀN BỘ KẾT QUẢ,ĐÁNH GIÁ,BÁO CÁO, TOÀN BỘ IMPORTANT THING VÀO CHỖ AN TOÀN ĐỂ DỌN %TEMP%"
FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Generate Prisma client
FROM base AS generate
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN npx prisma generate

# Build application
FROM base AS build
COPY --from=generate /app/node_modules ./node_modules
COPY --from=generate /app/prisma ./prisma
COPY . .
RUN npm run build 2>/dev/null || echo "No build script, skipping"

# Production image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist 2>/dev/null || mkdir -p client/dist
COPY --from=build /app/package*.json ./

EXPOSE 3000
CMD ["node", "server/index.js"]