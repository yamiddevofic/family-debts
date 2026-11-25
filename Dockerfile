# DT-14 — un contenedor, un volumen.
#
# Un solo proceso Node sirve la API y los estáticos de la web. La base es un archivo dentro
# del volumen: respaldar es copiarlo (RNF-09). Sin Compose, sin cola, sin servicios extra
# (Artículo VIII).

FROM node:24-slim AS construccion
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV RUTA_BASE_DATOS=/datos/deudas.db
ENV ZONA_HORARIA=America/Bogota

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace=@deudas/api --include-workspace-root

COPY --from=construccion /app/packages/core/dist packages/core/dist
COPY --from=construccion /app/apps/api/dist apps/api/dist
COPY --from=construccion /app/apps/web/dist apps/web/dist

VOLUME /datos
EXPOSE 8787
CMD ["node", "apps/api/dist/servidor.js"]
