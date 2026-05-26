FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./

RUN yarn install --immutable

COPY tsconfig.json ./
COPY src ./src

RUN yarn build

EXPOSE 3100

CMD ["node", "dist/index.js"]