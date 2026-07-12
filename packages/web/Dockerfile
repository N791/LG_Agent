# Stage 1: Prune workspace
FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm
RUN pnpm install turbo --global
COPY . .
RUN turbo prune --scope=@lg-agent/web --docker

# Stage 2: Installer
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm

COPY .gitignore .gitignore
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
RUN pnpm turbo run build --filter=@lg-agent/web...

# Stage 3: Runner (Nginx)
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# Non-root config for nginx
RUN sed -i 's/user  nginx;/user  1001;/g' /etc/nginx/nginx.conf
RUN chown -R 1001:1001 /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid && chown -R 1001:1001 /var/run/nginx.pid

# Provide a default SPA nginx config
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen       80;
    server_name  localhost;
    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
}
EOF

COPY --from=installer --chown=1001:1001 /app/packages/web/dist .

USER 1001

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
