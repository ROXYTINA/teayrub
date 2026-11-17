# Build from the repo root:  docker build -f server/Dockerfile -t clouddraw .
FROM node:20-alpine
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./
COPY web/ /app/web/
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
