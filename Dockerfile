# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json prisma.config.ts ./
COPY scripts ./scripts
COPY src ./src
# `npm run build` also copies the generated Prisma client into dist/ — the
# compiled output imports it from ./generated/client relative to itself.
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY docs/openapi.json ./docs/openapi.json
# Migrations only: the generated client already lives inside dist/.
COPY --from=build /app/src/infrastructure/prisma/schema.prisma ./src/infrastructure/prisma/schema.prisma
COPY --from=build /app/src/infrastructure/prisma/migrations ./src/infrastructure/prisma/migrations
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
