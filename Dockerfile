FROM node:18-alpine

# sharp 渲染定位图叠加层（SVG 文字：中文船名、经纬度、海区编号）需要字体，
# Alpine 基础镜像默认不带任何字体，不装的话所有文字都会糊成方块
RUN apk add --no-cache font-noto-cjk fontconfig

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "src/server/index.js"]