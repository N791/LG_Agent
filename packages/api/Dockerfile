# Stage 1: Prune workspace
FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=@lg-agent/api --docker

# Stage 2: Installer
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN corepack enable pnpm

# First install dependencies
COPY .gitignore .gitignore
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/packages/api/prisma/schema.prisma ./packages/api/prisma/schema.prisma
RUN pnpm install --frozen-lockfile

# Then copy source code and build
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
COPY tsconfig.base.json tsconfig.base.json
# Generate Prisma Client (Assuming schema is in packages/api/prisma/schema.prisma)
RUN pnpm --filter @lg-agent/api exec prisma generate
RUN pnpm turbo run build --filter=@lg-agent/api...

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Install only production dependencies
COPY --from=installer /app/package.json ./package.json
COPY --from=installer /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/json/ ./
COPY --from=installer /app/packages/api/prisma/schema.prisma ./packages/api/prisma/schema.prisma
# Prisma CLI is a production dependency because the immutable API image is also
# the release transaction image used by the Helm migration hook.
RUN corepack enable pnpm && npm pkg delete scripts.prepare && pnpm install --frozen-lockfile --prod

# Copy Prisma schema and generate client
COPY --from=installer /app/packages/api/prisma ./packages/api/prisma
RUN pnpm --filter @lg-agent/api exec prisma generate --schema=prisma/schema.prisma \
    && rm -rf /root/.cache/node/corepack /root/.npm \
      /usr/local/lib/node_modules/corepack /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/corepack /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/pnpm /usr/local/bin/pnpx \
    && ln -s ../packages/api/node_modules/prisma /app/node_modules/prisma

# Copy compiled code
COPY --from=installer /app/packages/api/dist ./packages/api/dist
COPY --from=installer /app/packages/api/package.json ./packages/api/package.json

USER nestjs

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "packages/api/dist/main.js"]
