FROM node:20-alpine3.20

WORKDIR /app

RUN apk add --no-cache bash docker-cli docker-cli-compose

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 8088

CMD ["node", "index.js"]
