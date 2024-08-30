const mysql = require('mysql2/promise');

const areaData = require('./area.json');

const updateFishingArea = async () => {
    const connection = await mysql.createConnection({
        host: 'xxx',
        user: 'xxx',
        password: 'xxx',
        database: 'xxx',
    });

    const [rows] = await connection.query('SELECT name_en, staticinfoupdatetime, longitude, latitude FROM Ships');
    for (const row of rows) {
        const longitudeKey = Math.floor(row.longitude) + (row.longitude % 1 >= 0.5 ? 0.5 : 0);
        const latitudeKey = Math.floor(row.latitude) + (row.latitude % 1 >= 0.5 ? 0.5 : 0);
        const area = areaData[`[${longitudeKey}, ${latitudeKey}]`];
        if (area !== undefined) {
            try {
                await connection.query('UPDATE Ships SET area = ? WHERE name_en = ? AND staticinfoupdatetime = ?', [area, row.name_en, row.staticinfoupdatetime]);
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    await connection.end();
};

updateFishingArea().catch(console.error);
