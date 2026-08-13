# =========================
# Build Stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build app
RUN npm run build

# =========================
# Production Stage
# =========================
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=development

# Copy package files
COPY package*.json ./

# Install only production dependencies
# The runtime uses PostgreSQL. TypeORM declares SQLite drivers as optional peer
# dependencies; omit optional packages so the Alpine image does not compile an
# unused native sqlite3 driver through node-gyp.
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# Copy build files from builder
COPY --from=builder /app/dist ./dist



# Security: tạo non-root user
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main"]
