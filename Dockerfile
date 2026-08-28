FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm exec tsc

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache fontconfig libc6-compat \
  && corepack enable && corepack prepare pnpm@10.17.0 --activate
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY public ./public
COPY fonts ./fonts
RUN mkdir -p /app/data /app/cache/fonts /app/banners
EXPOSE 3000
CMD ["node", "dist/index.js"]
