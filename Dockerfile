FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
USER node
EXPOSE 5124
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:5124/healthz || exit 1
CMD ["node", "server.js"]
