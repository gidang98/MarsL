# MarsL Dockerfile
# Build: docker build -t marsl .
# Run:   docker run -p 3000:3000 -v $(pwd)/data:/app/data marsl

FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data /app/logs /app/backups

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV LOG_DIR=/app/logs
ENV BACKUP_DIR=/app/backups

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run migrations and start server
CMD ["sh", "-c", "node scripts/migrate.js up && node server.js"]
