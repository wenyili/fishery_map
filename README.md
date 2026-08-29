# 渔船地图（Fishery Map）

一个用于展示渔船位置与海区的交互式地图应用。后端负责抓取渔船最新位置并写入数据库并提供接口；前端在地图上叠加海区网格、经纬网格与瓦片图层进行可视化与交互。

## 功能概览
- 交互式地图展示渔船最新位置（Leaflet）。
- 叠加海区网格（0.5° 多边形）与经纬网格（Graticule）。
- 支持本地瓦片图层 `/tms/{z}/{x}/{y}.png`。
- 后端抓取 HiFleet 数据并入库，提供查询接口供前端渲染。
- 日期筛选历史最新位置与手动触发数据更新。

## 目录结构
- 前端：`src/client/`（`index.html`、`index.js`、`ship.js`、`fishery_area.js`、`graticule.js`、`leaflet-list-markers.*`）
- 后端：`src/server/index.js`
- 数据：`data/ships.json`（船名清单）、`data/area.json`（海区映射）、`data/spider.js`（独立抓取脚本）
- 数据库初始化：`sql/init.sql`
- 构建与服务：`webpack.config.js`、`package.json`、`Dockerfile`、`docker-compose.yml`

## 后端服务与数据流
- 技术栈：Express + Postgres + axios。
- 数据库初始化：服务启动时检查 `Ships` 表，不存在则执行 `sql/init.sql` 创建表与索引。
- 数据抓取：从 `data/ships.json` 读取船名，调用 HiFleet 接口获取经纬度与更新时间；按 0.5° 网格映射到 `data/area.json` 的海区；写入 `Ships` 表。
- 环境变量：参考 `.env.example`（Postgres 连接、`HIFLEET_COOKIE`、瓦片目录、域名等）。

### API
- `GET /api/latest?before=<unix_timestamp_seconds>`
  - 返回每条船在指定时间之前的最新位置与时间信息。
  - 响应内含 `updatetimeformat`（例如 `12h` 或 `30min`）与后端计算的相对时间标识。
- `GET /api/new`
  - 遍历 `data/ships.json`，抓取每条船最新数据并写入数据库；成功后返回船只列表。

### 数据库表结构（简要）
- 表：`Ships`
  - `name_en VARCHAR(32) NOT NULL`
  - `name_zh VARCHAR(32) NOT NULL`
  - `longitude DECIMAL(9,6)`，`latitude DECIMAL(9,6)`
  - `area INTEGER`
  - `updatetimestamp TIMESTAMP`
  - `updatetimeformat VARCHAR(32)`
  - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
  - `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
  - 主键：`PRIMARY KEY (name_en, updatetimestamp)`
  - 索引：`idx_name_en`、`idx_name_zh`

## 前端可视化与交互
- 瓦片图层：`/tms/{z}/{x}/{y}.png`（`NAVIONICS_DICT` 指向的目录，通过服务器静态托管）。
- 经纬网格：`src/client/graticule.js` 绘制并标注经纬度。
- 海区网格：`src/client/fishery_area.js` 基于 `data/area.json` 按 0.5° 网格生成多边形，支持悬停高亮与点击缩放到海区。
- 渔船点位：`src/client/ship.js` 将 API 返回的数据转为 GeoJSON 点并以圆形标记展示，Tooltip 显示详细信息。
- 渔船列表：`src/client/leaflet-list-markers.js` 在右下角展示船只列表，可与地图联动（鼠标悬停高亮、点击定位）。
- 信息面板：显示中文船名、海区、经纬度、更新时间与相对时间（`src/client/index.js`）。
- 日期筛选与数据更新：
  - 日期选择器会生成次日 0 点的 `before` 时间戳调用 `/api/latest`。
  - “更新数据”按钮调用 `/api/new` 抓取数据后刷新视图。

## 本地开发
1. 安装依赖：
   ```bash
   npm install
   ```
2. 配置环境：复制 `.env.example` 为 `.env` 并填入实际值（至少包含 Postgres、`HIFLEET_COOKIE`、`NAVIONICS_DICT`/`NAVIONICS_DICT_HOST`）。
3. 启动：
   - 一体化构建并启动后端（同时提供静态前端）：
     ```bash
     npm run start
     # 访问 http://localhost:3000
     ```
   - 前后端分开开发（webpack 开发服务器 + 后端）：
     ```bash
     npm run server   # http://localhost:3000
     npm run client   # http://localhost:9000（代理 /api 与 /tms 到 3000）
     ```

## 独立数据抓取脚本
- 运行脚本将按 `ships.json` 抓取并入库：
  ```bash
  npm run spider
  ```

## Docker 部署
- 依赖：Docker、Docker Compose、Traefik（可选）。
- 关键环境变量：
  - `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `ENDPOINT_ID`
  - `NAVIONICS_DICT_HOST`（宿主机瓦片目录，将挂载至容器 `/app/tiles`）
  - `HIFLEET_COOKIE`
  - `DOMAIN`（Traefik 路由使用）
- 启动：
  ```bash
  docker-compose up -d
  # 服务暴露在 3000 端口；使用 Traefik 时按 compose 标签进行路由
  ```

### 使用 Traefik 进行整站鉴权（BasicAuth）
本项目已在 `docker-compose.yml` 中添加 Traefik BasicAuth 中间件配置，启用后整站（含页面、API、瓦片）都会要求登录。

1) 生成凭据（二选一）：
- htpasswd（推荐）：
  ```bash
  htpasswd -nb your_user your_password
  # 输出形如：your_user:$apr1$...$...
  ```
- OpenSSL：
  ```bash
  echo "your_user:$(openssl passwd -apr1 'your_password')"
  ```

2) 配置环境变量：
- 将生成的 `user:hash` 写入 `.env` 中：
  ```env
  TRAEFIK_BASIC_AUTH_USERS=your_user:$apr1$...$...
  ```
- 支持多个用户，逗号分隔：
  ```env
  TRAEFIK_BASIC_AUTH_USERS=user1:$apr1$...$...,user2:$apr1$...$...
  ```

3) 重新部署：
```bash
docker-compose up -d
```

说明：
- 相关标签：
  - `traefik.http.middlewares.fishery-auth.basicauth.users=${TRAEFIK_BASIC_AUTH_USERS}`
  - `traefik.http.routers.fishery-map.middlewares=fishery-auth@docker`
- 中间件作用域为路由 `fishery-map`，因此该域名下的所有请求都会被保护。

## 重要说明
- 抓取依赖第三方服务（HiFleet），`HIFLEET_COOKIE` 必须有效且具备访问权限。
- 首次启动后端会自动初始化数据库；如表已存在则跳过。
- 前端构建产物输出至 `public/` 并由后端静态托管。

## 参考文件
- 后端入口：`src/server/index.js`
- 前端入口：`src/client/index.js`
- 数据与脚本：`data/ships.json`、`data/area.json`、`data/spider.js`
- 数据库初始化：`sql/init.sql`
- 构建与开发：`webpack.config.js`、`package.json`
- 容器与部署：`Dockerfile`、`docker-compose.yml`
