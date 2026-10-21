# Node.js Backend Production Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Final production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node modules from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Create uploads directory with write permissions
RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "server.js"]
