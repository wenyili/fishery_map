const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const db = mysql.createPool({
    host: 'xxx',
    user: 'xxx',
    password: 'xxx',
    database: 'xxx',
});

const app = express();
const port = 3000;

// 托管静态文件
app.use(express.static(path.join(__dirname, '../../public')));

// Create a new router
const apiRouter = express.Router();
apiRouter.get('/ships', async (req, res) => {
    const name = req.query.name;
    let rows;
    if (!name) {
        [rows] = await db.query('SELECT DISTINCT name_en, name_zh FROM Ships')
    } else {
        [rows] = await db.query('SELECT DISTINCT name_en, name_zh FROM Ships WHERE name_en LIKE ? OR name_zh LIKE ?', [`%${name}%`, `%${name}%`]);
    }
    res.json(rows);
});

apiRouter.get('/ship/:name', async (req, res) => {
    const after = req.query.after ? new Date(Number(req.query.after)) : new Date(0);
    const [rows] = await db.query('SELECT * FROM Ships WHERE name_en = ? AND staticinfoupdatetime > ? ORDER BY staticinfoupdatetime', [req.params.name, after]);
    res.json(rows);
});

apiRouter.get('/latest', async (req, res) => {
    const after = req.query.after ? new Date(Number(req.query.after)) : new Date(0);
    const [rows] = await db.query(`
        SELECT s1.*
        FROM Ships s1
        JOIN (
            SELECT name_en, MAX(staticinfoupdatetime) AS max_time
            FROM Ships 
            WHERE staticinfoupdatetime > ?
            GROUP BY name_en
        ) s2
        ON s1.name_en = s2.name_en AND s1.staticinfoupdatetime = s2.max_time
    `, [after]);
    res.json(rows);
});

// Use the router with /api prefix
app.use('/api', apiRouter);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
