FROM node:22-slim
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json* ./apps/api/
RUN cd apps/api && npm install
COPY apps/api ./apps/api
COPY content ./content
RUN cd apps/api && npm run build
CMD ["node", "apps/api/dist/main.js"]
