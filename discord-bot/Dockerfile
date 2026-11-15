# Runs the bot on any container host (Render, Railway, Fly.io, a VPS). Settings come from environment variables.
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
CMD ["node", "src/index.js"]
