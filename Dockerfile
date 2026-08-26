# Multi-stage Dockerfile for Scheme Whisperer on Google Cloud Run
FROM node:24-alpine AS builder

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Production runner stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy node modules and application code
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY data ./data
COPY public ./public
COPY src ./src

# Use non-root node user for security
USER node

EXPOSE 8080

CMD ["node", "src/server.js"]
