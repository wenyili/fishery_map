// 从stdin读取export_updates.js产生的JSON，按(name_en, updatetimestamp)做upsert，
// 仅当对方的updated_at比本地更新时才覆盖，避免覆盖掉本地更新的数据。
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

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

(async () => {
  const input = await readStdin();
  const rows = input.trim() ? JSON.parse(input) : [];

  let applied = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await sql`
      INSERT INTO ships (name_en, name_zh, longitude, latitude, area, updatetimestamp, updatetimeformat, created_at, updated_at)
      VALUES (${row.name_en}, ${row.name_zh}, ${row.longitude}, ${row.latitude}, ${row.area}, ${row.updatetimestamp}, ${row.updatetimeformat}, ${row.created_at}, ${row.updated_at})
      ON CONFLICT (name_en, updatetimestamp)
      DO UPDATE SET
        name_zh = EXCLUDED.name_zh,
        longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude,
        area = EXCLUDED.area,
        updatetimeformat = EXCLUDED.updatetimeformat,
        updated_at = EXCLUDED.updated_at
      WHERE EXCLUDED.updated_at > ships.updated_at
    `;
    if (result.count > 0) {
      applied++;
    } else {
      skipped++;
    }
  }
  console.log(`同步完成：收到 ${rows.length} 条，写入/更新 ${applied} 条，本地已是更新数据跳过 ${skipped} 条`);
  await sql.end();
})().catch(err => {
  console.error('导入失败:', err.message);
  process.exit(1);
});
