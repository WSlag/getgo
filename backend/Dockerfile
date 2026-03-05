# Use official Node.js 20 LTS image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy application source
COPY . .

# Cloud Run will set PORT env var (defaults to 8080)
ENV PORT=8080

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose the port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
