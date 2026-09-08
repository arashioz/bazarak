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

RUN apk add --no-cache python3 py3-pip && pip3 install --no-cache-dir --break-system-packages msoffcrypto-tool

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/app/data/database.json ./app/data/database.json
COPY --from=build /app/scripts/migrate-json-to-mongo.mjs ./scripts/migrate-json-to-mongo.mjs
COPY --from=build /app/scripts/import-persons-customers.mjs ./scripts/import-persons-customers.mjs
COPY --from=build /app/scripts/import-mobile-services.mjs ./scripts/import-mobile-services.mjs
COPY --from=build /app/node_modules/xlsx ./node_modules/xlsx
COPY --from=build /app/node_modules/adler-32 ./node_modules/adler-32
COPY --from=build /app/node_modules/cfb ./node_modules/cfb
COPY --from=build /app/node_modules/codepage ./node_modules/codepage
COPY --from=build /app/node_modules/crc-32 ./node_modules/crc-32
COPY --from=build /app/node_modules/ssf ./node_modules/ssf
COPY --from=build /app/node_modules/wmf ./node_modules/wmf
COPY --from=build /app/node_modules/word ./node_modules/word

EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrate-json-to-mongo.mjs && node server.js"]
