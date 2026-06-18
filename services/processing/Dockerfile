FROM node:20-alpine AS deps
WORKDIR /app
COPY services/processing/package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runner
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY services/processing/src ./src
COPY proto ./proto
USER appuser
EXPOSE 50052
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "require('net').createConnection(50052,'localhost').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
CMD ["node", "src/index.js"]
