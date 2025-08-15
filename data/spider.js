const axios = require('axios');
const ships = require('./ships.json');
const areaData = require('./area.json');
const postgres = require('postgres');
require('dotenv').config();

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID, HIFLEET_COOKIE } = process.env;
PGPASSWORD = decodeURIComponent(PGPASSWORD);

const postgresConfig = {
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: 'require',
};

if (ENDPOINT_ID) {
  postgresConfig.connection = {
    options: `project=${ENDPOINT_ID}`,
  };
}

const sql = postgres(postgresConfig);

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

        const updatetimestamp = data.updatetimestamp ? data.updatetimestamp : getUpdateTimestamp(data.updatetimeformat);
            
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

const run = async () => {
    for (const ship of ships) {
        await getDataAndSaveToDB(ship);
    }
    await sql.end();
    console.log('All operations completed. Database connection closed.');
};

run();