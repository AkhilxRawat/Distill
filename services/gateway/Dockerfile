# Stage 1 — install production dependencies only
FROM node:20-alpine AS deps
WORKDIR /app
COPY services/gateway/package*.json ./
RUN npm ci --only=production

# Stage 2 — lean final image
FROM node:20-alpine AS runner
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY services/gateway/src ./src
COPY proto ./proto
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "require('http').get('http://localhost:3000/health',(r)=>r.statusCode===200?process.exit(0):process.exit(1)).on('error',()=>process.exit(1))"
CMD ["node", "src/index.js"]