FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production PORT=3000
RUN mkdir -p /app/database /app/backups && chown -R node:node /app
USER node
EXPOSE 3000
VOLUME ["/app/database", "/app/backups"]
CMD ["npm", "start"]
