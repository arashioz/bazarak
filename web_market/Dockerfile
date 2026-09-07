FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=3000
ENV MONGODB_URI=mongodb://mongo:27017/bazarek
ENV MONGODB_DB=bazarek

WORKDIR /app

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/app/data/database.json ./app/data/database.json
COPY --from=build /app/scripts/migrate-json-to-mongo.mjs ./scripts/migrate-json-to-mongo.mjs

EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrate-json-to-mongo.mjs && node server.js"]
