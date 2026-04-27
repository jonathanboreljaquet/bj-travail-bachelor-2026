FROM node:24.14.0-alpine3.23

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV PORT=3002

EXPOSE 3002

CMD ["npm", "run", "dev"]
