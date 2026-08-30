// 导出最近有更新的船只记录（按 updated_at 筛选），输出JSON到stdout。
// 用法: node data/export_updates.js [天数，默认3]
require('dotenv').config();
const postgres = require('postgres');

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;
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

process.stdout.on('error', err => {
  if (err.code === 'EPIPE') process.exit(0);
});

const days = parseInt(process.argv[2]) || 3;

(async () => {
  const rows = await sql`
    SELECT name_en, name_zh, longitude, latitude, area, updatetimestamp, updatetimeformat, created_at, updated_at
    FROM ships
    WHERE updated_at > NOW() - make_interval(days => ${days})
  `;
  process.stdout.write(JSON.stringify(rows));
  await sql.end();
})().catch(err => {
  console.error('导出失败:', err.message);
  process.exit(1);
});
