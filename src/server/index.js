const express = require('express');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config();
const ships = require('../../data/ships.json');
const areaData = require('../../data/area.json');

const axios = require('axios');

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID, NOVIONICS_DICT } = process.env;
PGPASSWORD = decodeURIComponent(PGPASSWORD);

const sql = postgres({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: 'require',
  connection: {
    options: `project=${ENDPOINT_ID}`,
  },
});

const app = express();
const port = 3000;

// 托管静态文件
app.use(express.static(path.join(__dirname, '../../public')));

app.use('/tms/', express.static(path.join(NOVIONICS_DICT)));

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
            SELECT name_en, MAX(staticinfoupdatetime) AS max_time
            FROM Ships 
            WHERE EXTRACT(EPOCH FROM updatetimestamp) < ${before}
            GROUP BY name_en
        ) s2
        ON s1.name_en = s2.name_en AND s1.staticinfoupdatetime = s2.max_time ORDER BY s1.name_en
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
          'Cookie': 'Hm_lvt_5a549381614f27b883ebd27bf0e218a0=1725240838; HMACCOUNT=843FC992424A8454; _gcl_au=1.1.961345004.1725240838; JSESSIONID=1386FDD0D4670597C7942CA01B8D814A; TGC=TGT-144943-kIWjOwIr--vFydw2iysGtEQSRjBSCoCqLTUqOzAqDZurGakKEk4la5ySQVvKBGY5RGsiZ1y6w208fk1crZ; Hm_lpvt_5a549381614f27b883ebd27bf0e218a0=1726218365; ISCHECKURLRISK=undefined', 
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

    if (response.data && response.data.staticinfoupdatetime) {
        const data = response.data;

        const longitudeKey = Math.floor(data.lo) + (data.lo % 1 >= 0.5 ? 0.5 : 0);
        const latitudeKey = Math.floor(data.la) + (data.la % 1 >= 0.5 ? 0.5 : 0);
        const area = areaData[`[${longitudeKey}, ${latitudeKey}]`] || null;

        const updatetimestamp = data.updatetimestamp ? data.updatetimestamp : getUpdateTimestamp(data.updatetimeformat);
        // Check if the record exists
        const existing = await sql`SELECT 1 FROM Ships WHERE name_en = ${ship.name_en} AND staticinfoupdatetime = ${new Date(data.staticinfoupdatetime.time).toISOString()}`;
        if (existing.count > 0) {
            // Update the record
            await sql`
                UPDATE Ships 
                SET name_en = ${ship.name_en},
                    name_zh = ${ship.name_zh},
                    longitude = ${data.lo},
                    latitude = ${data.la},
                    staticinfoupdatetime = ${new Date(data.staticinfoupdatetime.time).toISOString()},
                    updatetimeformat = ${data.updatetimeformat},
                    updatetimestamp = ${new Date(updatetimestamp).toISOString()},
                    area = ${area},
                    updated_at = CURRENT_TIMESTAMP
                WHERE name_en = ${ship.name_en} AND staticinfoupdatetime = ${new Date(data.staticinfoupdatetime.time).toISOString()}`;
        } else {
            // Insert a new record
            await sql`
                INSERT INTO Ships (name_en, name_zh, longitude, latitude, staticinfoupdatetime, updatetimeformat, updatetimestamp, area, created_at)
                VALUES (${ship.name_en}, ${ship.name_zh}, ${data.lo}, ${data.la}, ${new Date(data.staticinfoupdatetime.time).toISOString()}, ${data.updatetimeformat}, ${new Date(updatetimestamp).toISOString()}, ${area}, CURRENT_TIMESTAMP)`;
        }
        console.log(`Ship ${ship.name_en} saved to database.`);
    } else {
        console.error(`No data found for ship: ${ship.name_en}`);
    }
};
// Use the router with /api prefix
app.use('/api', apiRouter);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
