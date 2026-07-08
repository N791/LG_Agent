# Base image
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.15.9

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy workspace config and lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy web package source
COPY packages/web ./packages/web

# Install dependencies
RUN pnpm install --filter @lg-agent/web...

# Build the Web project
RUN pnpm --filter @lg-agent/web run build

# Runner stage (Nginx)
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration for SPA routing
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
