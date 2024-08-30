const axios = require('axios');
const mysql = require('mysql2/promise');
const ships = require('./ships.json');
const areaData = require('./area.json');

const db = mysql.createPool({
    host: 'xxx',
    user: 'xxx',
    password: 'xxx',
    database: 'xxx',
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
          'Cookie': 'Hm_lvt_5a549381614f27b883ebd27bf0e218a0=1724639694; HMACCOUNT=97580295C6121E28; _gcl_au=1.1.966010719.1724639694; JSESSIONID=D07F98A351BCC57C45008BB5593822E3; Hm_lpvt_5a549381614f27b883ebd27bf0e218a0=1724835266', 
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

        await db.query(`
            INSERT INTO Ships (name_en, name_zh, longitude, latitude, staticinfoupdatetime, updatetimeformat, area) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            name_en = VALUES(name_en),
            name_zh = VALUES(name_zh),
            longitude = VALUES(longitude),
            latitude = VALUES(latitude),
            staticinfoupdatetime = VALUES(staticinfoupdatetime),
            updatetimeformat = VALUES(updatetimeformat),
            area = VALUES(area)`,
            [ship.name_en, ship.name_zh, data.lo, data.la, new Date(data.staticinfoupdatetime.time), data.updatetimeformat, area]
        );
        console.log(`Ship ${ship.name_en} saved to database.`);
    } else {
        console.error(`No data found for ship: ${ship.name_en}`);
    }
};

const run = async () => {
    for (const ship of ships) {
        await getDataAndSaveToDB(ship);
    }
    await db.end();
    console.log('All operations completed. Database connection closed.');
};

run();