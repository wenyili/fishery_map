const express = require('express');
const path = require('path');
const postgres = require('postgres');
const fs = require('fs');
require('dotenv').config();
const ships = require('../../data/ships.json');
const areaData = require('../../data/area.json');

const axios = require('axios');

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID, NAVIONICS_DICT, HIFLEET_COOKIE } = process.env;
PGPASSWORD = decodeURIComponent(PGPASSWORD);

const postgresConfig = {
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: false,
};

if (ENDPOINT_ID) {
  postgresConfig.connection = {
    options: `project=${ENDPOINT_ID}`,
  };
}

const sql = postgres(postgresConfig);

const app = express();
const port = 3000;

// 数据库初始化函数
const initializeDatabase = async () => {
  try {
    // 检查Ships表是否存在
    await sql`SELECT 1 FROM Ships LIMIT 1`;
    console.log('Database tables already exist, skipping initialization');
  } catch (error) {
    // 检查是否是因为表不存在的错误
    if (error.code === '42P01' || error.message.includes('relation "ships" does not exist')) {
      console.log('Ships table not found, initializing database...');
      try {
        const initSQL = fs.readFileSync(path.join(__dirname, '../../sql/init.sql'), 'utf8');
        await sql.unsafe(initSQL);
        console.log('Database initialized successfully');
      } catch (initError) {
        console.error('Failed to initialize database:', initError);
        throw initError;
      }
    } else {
      console.error('Database connection or query error:', error);
      throw error;
    }
  }
};

// 托管静态文件
app.use(express.static(path.join(__dirname, '../../public')));

app.use('/tms/', express.static(path.join(NAVIONICS_DICT)));

// Create a new router
const apiRouter = express.Router();

apiRouter.get('/latest', async (req, res) => {
    // 获取明天的0点0分0秒的时间戳
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowTimestamp = tomorrow.getTime() / 1000;
    const before = req.query.before ? req.query.before : tomorrowTimestamp;
    const rows = await sql`
        SELECT s1.name_en, s1.name_zh, s1.longitude, s1.latitude, s1.area, EXTRACT(EPOCH FROM s1.updatetimestamp) AS updatetimestamp, 
            EXTRACT(EPOCH FROM s1.created_at) AS created_at, EXTRACT(EPOCH FROM s1.updated_at) AS updated_at
        FROM Ships s1
        JOIN (
            SELECT name_en, MAX(updatetimestamp) AS max_time
            FROM Ships 
            WHERE EXTRACT(EPOCH FROM updatetimestamp) < ${before}
            GROUP BY name_en
        ) s2
        ON s1.name_en = s2.name_en AND s1.updatetimestamp = s2.max_time ORDER BY s1.name_en
    `;
    // 修改row中的updatetimeformat字段，由当前时间和updatetimestamp字段计算获得
    // 如果相差时间大于1小时，则updatetimeformat计算表达成xh(x为整数)，否则计算为xmin(x为整数)
    rows.forEach(row => {
        const diff = new Date() - new Date(row.updatetimestamp * 1000);
        if (diff > 3600 * 1000) {
            row.updatetimeformat = `${Math.floor(diff / 3600 / 1000)}h`;
        } else {
            row.updatetimeformat = `${Math.floor(diff / 60 / 1000)}min`;
        }
    })
    res.json(rows);
});

apiRouter.get('/new', async (req, res) => {
    for (const ship of ships) {
        await getDataAndSaveToDB(ship);
    }
    res.json(ships);
});

const getUpdateTimestamp = (name_en, updatetimeformat) => {
    console.log(`ship ${name_en} updatetimeformat: ${updatetimeformat}`);
    if (updatetimeformat.endsWith("min")) {
        const minutes = parseInt(updatetimeformat.replace("min", ""));
        const updatetime = new Date();
        updatetime.setMinutes(updatetime.getMinutes() - Math.abs(minutes));
        return updatetime.getTime();
    } else if (updatetimeformat.endsWith("h")) {
        const hours = parseInt(updatetimeformat.replace("h", ""));
        const updatetime = new Date();
        updatetime.setHours(updatetime.getHours() - Math.abs(hours));
        return updatetime.getTime();
    } else if (updatetimeformat.endsWith("d")) {
        const days = parseInt(updatetimeformat.replace("d", ""));
        const updatetime = new Date();
        updatetime.setDate(updatetime.getDate() - Math.abs(days));
        return updatetime.getTime();
    } else {
        throw new Error(`Invalid updatetimeformat: ${updatetimeformat}`);
    }
}

const getDataAndSaveToDB = async (ship) => {
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://www.hifleet.com/hifleetapi/searchVesselOL.do?&i18n=en&_v=5.3.559',
        headers: { 
          'Accept': 'application/json, text/plain, */*', 
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7', 
          'Cache-Control': 'no-cache', 
          'Connection': 'keep-alive', 
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 
          'Cookie': HIFLEET_COOKIE, 
          'Origin': 'https://www.hifleet.com', 
          'Pragma': 'no-cache', 
          'Referer': 'https://www.hifleet.com/', 
          'Sec-Fetch-Dest': 'empty', 
          'Sec-Fetch-Mode': 'cors', 
          'Sec-Fetch-Site': 'same-origin', 
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36', 
          'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"', 
          'sec-ch-ua-mobile': '?0', 
          'sec-ch-ua-platform': '"macOS"'
        },
        data : `keyword=${ship.name_en}`
    };
    const response = await axios(config);

    if (response.data) {
        const data = response.data;

        const longitudeKey = Math.floor(data.lo) + (data.lo % 1 >= 0.5 ? 0.5 : 0);
        const latitudeKey = Math.floor(data.la) + (data.la % 1 >= 0.5 ? 0.5 : 0);
        const area = areaData[`[${longitudeKey}, ${latitudeKey}]`] || null;

        const updatetimestamp = data.updatetimestamp ? data.updatetimestamp : getUpdateTimestamp(ship.name_en, data.updatetimeformat);
            
        // Check if the record exists
        const existing = await sql`SELECT 1 FROM Ships WHERE name_en = ${ship.name_en} AND updatetimestamp = ${new Date(data.updatetimestamp).toISOString()}`;
        if (existing.count > 0) {
            // Update the record
            await sql`
                UPDATE Ships 
                SET name_en = ${ship.name_en},
                    name_zh = ${ship.name_zh},
                    longitude = ${data.lo},
                    latitude = ${data.la},
                    updatetimeformat = ${data.updatetimeformat},
                    updatetimestamp = ${new Date(updatetimestamp).toISOString()},
                    area = ${area},
                    updated_at = CURRENT_TIMESTAMP
                WHERE name_en = ${ship.name_en} AND updatetimestamp = ${new Date(data.updatetimestamp).toISOString()}`;
        } else {
            // Insert a new record
            await sql`
                INSERT INTO Ships (name_en, name_zh, longitude, latitude, updatetimeformat, updatetimestamp, area, created_at)
                VALUES (${ship.name_en}, ${ship.name_zh}, ${data.lo}, ${data.la}, ${data.updatetimeformat}, ${new Date(updatetimestamp).toISOString()}, ${area}, CURRENT_TIMESTAMP)`;
        }
        console.log(`Ship ${ship.name_en} saved to database.`);
    } else {
        console.error(`No data found for ship: ${ship.name_en}`);
    }
};
// Use the router with /api prefix
app.use('/api', apiRouter);

// 启动服务器
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
