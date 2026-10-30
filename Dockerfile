FROM node:26-alpine3.23

WORKDIR /vaxocare

COPY ./package*.json .

RUN npm install

COPY . .

CMD ["npm", "run", "dev"]