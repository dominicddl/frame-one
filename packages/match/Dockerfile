# Frame One Match Server (serves API + web in single-host mode)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/data/package.json ./packages/data/
COPY packages/match/package.json ./packages/match/
COPY packages/web/package.json ./packages/web/

# Install all dependencies (including web for build)
RUN npm ci

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/data ./packages/data
COPY packages/match ./packages/match
COPY packages/web ./packages/web

# Build packages in order (including web for single-host serving)
RUN npm run build -w @frame-one/shared
RUN npm run build -w @frame-one/data
RUN npm run build -w @frame-one/match
RUN npm run build -w @frame-one/web

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/data/package.json ./packages/data/
COPY --from=builder /app/packages/data/dist ./packages/data/dist
COPY --from=builder /app/packages/data/data ./packages/data/data
COPY --from=builder /app/packages/data/assets ./packages/data/assets
COPY --from=builder /app/packages/match/package.json ./packages/match/
COPY --from=builder /app/packages/match/dist ./packages/match/dist
COPY --from=builder /app/packages/match/harness ./packages/match/harness
# Include web dist for single-host mode
COPY --from=builder /app/packages/web/dist ./packages/web/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "packages/match/dist/index.js"]
