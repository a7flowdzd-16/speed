FROM node:18-alpine

WORKDIR /app

# IMPORTANT: Install ffmpeg securely for HLS transcoding inside the container
RUN apk update && apk add --no-cache ffmpeg

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose ports: Socket.io (3000), RTMP Broadcaster (1935), HLS Viewers (8000)
EXPOSE 3000 1935 8000

# Start Engine
CMD ["node", "server.js"]
