FROM node:22-alpine

# Set working directory
WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD 1

# Install dependencies
COPY package*.json ./
RUN npm install --only=production --verbose

# Copy application code
COPY src/ ./src/
COPY init-mongo.js ./

# Create necessary directories
RUN mkdir -p uploads reports temp
RUN mkdir ./test ./test/data && touch ./test/data/05-versions-space.pdf

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Run the application
CMD ["npm", "start"]