# Imagen de producción del monorepo. Por defecto arranca el bot; sobreescribe
# el CMD (o usa docker-compose para desarrollo) para ejecutar otra app.
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /repo

# Copia primero los manifiestos para aprovechar la caché de capas de Docker.
COPY package.json package-lock.json ./
COPY apps/bot/package.json apps/bot/
COPY apps/web/package.json apps/web/
COPY apps/overlays/package.json apps/overlays/
COPY packages/common/package.json packages/common/
RUN npm install --omit=dev --workspaces --include-workspace-root

# Copia el resto del código del monorepo.
COPY . .

USER node
CMD ["npm", "--workspace", "apps/bot", "run", "start"]
