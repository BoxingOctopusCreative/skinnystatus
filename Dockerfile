# SkinnyStatus production image (SvelteKit adapter-node)
# Build:  docker build -t skinnystatus .
# Run:    docker run --rm -p 3000:3000 --env-file .env skinnystatus
# Require ORIGIN and DATABASE_URL (or Infisical credentials). See .env.example.

FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/status-page-template/package.json packages/status-page-template/package-lock.json ./packages/status-page-template/

RUN npm ci \
	&& npm ci --prefix packages/status-page-template

COPY . .

RUN npm run build:status-template \
	&& npm run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev \
	&& npm cache clean --force \
	&& mkdir -p .deploy-staging \
	&& chown -R node:node /app

COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/drizzle/pg ./drizzle/pg
COPY --from=builder --chown=node:node /app/packages/status-page-template/dist ./packages/status-page-template/dist

USER node
EXPOSE 3000

CMD ["node", "build"]
