FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm && npm install -g turbo
COPY . .
RUN turbo prune --scope=@lg-agent/web --docker

FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm
COPY .gitignore .gitignore
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY turbo.json tsconfig.base.json ./
RUN pnpm turbo run build --filter=@lg-agent/web...

FROM nginxinc/nginx-unprivileged:stable-alpine3.23 AS runner
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=installer --chown=101:101 /app/packages/web/dist /usr/share/nginx/html
EXPOSE 8080
USER 101
CMD ["nginx", "-g", "daemon off;"]
