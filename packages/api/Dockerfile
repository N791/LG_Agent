# Base image
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.15.9

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy root configurations and lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy API package source
COPY packages/api ./packages/api

# Install dependencies (only for API workspace and root)
RUN pnpm install --filter @lg-agent/api...

# Generate Prisma Client
RUN pnpm --filter @lg-agent/api run prisma:generate

# Build the API project
RUN pnpm --filter @lg-agent/api run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install pnpm for production dependencies installation if needed
# OR copy over the pruned node_modules. To keep it simple, we copy the entire app and use prod install.
RUN npm install -g pnpm@9.15.9

# Copy necessary files from builder
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

# In a real monorepo deploy, it's often better to deploy using a tool like turbo or deploy pruned workspace.
# For simplicity, we install prod dependencies here.
# Note: we also need prisma client generated in runner
RUN pnpm install --filter @lg-agent/api --prod --frozen-lockfile

# Re-generate prisma client in the runner just to be safe (requires prisma in deps or devDeps, but prod install might skip devDeps)
# If prisma client is bundled or generated, we copy it. Actually, `pnpm install` will trigger postinstall if `@prisma/client` is in deps.

EXPOSE 3000

CMD ["node", "packages/api/dist/main"]
