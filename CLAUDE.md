# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个渔船位置监控的Web应用，基于Leaflet地图展示渔船实时位置信息。系统包含数据抓取、存储和可视化三个主要模块。

## 常用开发命令

### 启动开发环境
```bash
# 启动后端服务器（开发模式，使用nodemon自动重启）
npm run server

# 启动前端开发服务器（端口9000，带热重载）
npm run client

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 运行数据爬虫更新船只信息
npm run spider
```

### 数据库相关
- PostgreSQL数据库表结构：`sql/postgresql/create_table_ship.sql`
- MySQL数据库表结构：`sql/mysql/create_table_ship.sql`
- 数据库连接需要环境变量：`PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `ENDPOINT_ID`

## 架构说明

### 前端架构（客户端）
- **入口文件**：`src/client/index.js` - 主地图应用逻辑
- **自定义Leaflet组件**：
  - `ship.js` - 渔船标记层，处理船只在地图上的显示
  - `fishery_area.js` - 渔区网格层，显示0.5度网格的渔区划分
  - `graticule.js` - 经纬度网格线
  - `leaflet-list-markers.js` - 船只列表控件
- **构建工具**：Webpack + Babel，输出到`public/`目录
- **地图服务**：使用TMS瓦片服务（`/tms/{z}/{x}/{y}.png`）

### 后端架构（服务器）
- **服务器**：`src/server/index.js` - Express服务器
- **API端点**：
  - `GET /api/latest` - 获取最新船只位置（支持时间过滤）
  - `GET /api/new` - 触发数据更新，抓取所有船只最新信息
- **数据抓取**：`data/spider.js` - 从hifleet.com获取船只位置数据
- **静态文件服务**：托管`public/`目录和TMS瓦片

### 数据模型
- **Ships表**：存储船只位置历史记录
  - 复合主键：(name_en, staticinfoupdatetime)
  - 包含中英文船名、经纬度、所属渔区、更新时间等字段
- **数据文件**：
  - `data/ships.json` - 监控的船只列表
  - `data/area.json` - 经纬度坐标到渔区的映射

### 开发服务器配置
- 前端开发服务器：端口9000，代理API请求到后端3000端口
- 后端服务器：端口3000
- 数据库：PostgreSQL（生产环境）

### 第三方依赖
- **地图**：Leaflet 1.9.4
- **数据库**：postgres库连接PostgreSQL
- **HTTP请求**：axios（用于数据抓取）
- **构建**：Webpack + Babel（ES6转换）

## 环境变量要求
项目需要`.env`文件包含数据库连接信息和Navionics瓦片路径：
- `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `ENDPOINT_ID`
- `NAVIONICS_DICT` - TMS瓦片文件目录路径