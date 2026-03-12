FROM node:20-alpine3.16
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8088
CMD ["node", "index.js"]
