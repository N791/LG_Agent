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
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm

# First install dependencies
COPY .gitignore .gitignore
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Then copy source code and build
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
# Generate Prisma Client (Assuming schema is in packages/api/prisma/schema.prisma)
RUN pnpm --filter @lg-agent/api exec prisma generate
RUN pnpm turbo run build --filter=@lg-agent/api...

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Install only production dependencies
COPY --from=installer /app/package.json ./package.json
COPY --from=installer /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=installer /app/out/json/ ./
# We need prisma for production runtime (engines)
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod

# Copy compiled code and prisma client
COPY --from=installer /app/packages/api/dist ./packages/api/dist
COPY --from=installer /app/packages/api/package.json ./packages/api/package.json
COPY --from=installer /app/node_modules/.prisma ./node_modules/.prisma

USER nestjs

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "packages/api/dist/src/main"]
