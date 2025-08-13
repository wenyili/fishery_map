const postgres = require('postgres');
require('dotenv').config();

async function updateShipTableFinal() {
  const sql = postgres({
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    username: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    ssl: process.env.PGHOST?.includes('aws.neon.tech') ? 'require' : false,
  });

  try {
    console.log('🚢 开始更新Ships表结构...');
    console.log('连接到数据库...');
    console.log('数据库连接成功');

    // 1. 检查当前状态
    console.log('\n=== 1. 检查当前状态 ===');
    
    const currentPK = await sql`
      SELECT 
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'ships' 
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `;
    
    if (currentPK.length > 0) {
      console.log('当前主键约束:');
      currentPK.forEach((pk, index) => {
        console.log(`  ${index + 1}. ${pk.column_name}`);
      });
    } else {
      console.log('当前没有主键约束');
    }

    const staticInfoCheck = await sql`
      SELECT is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ships' AND column_name = 'staticinfoupdatetime'
    `;
    
    if (staticInfoCheck.length > 0) {
      console.log(`staticinfoupdatetime列允许NULL: ${staticInfoCheck[0].is_nullable === 'YES' ? '是' : '否'}`);
    }

    // 2. 检查重复数据
    console.log('\n=== 2. 检查重复数据 ===');
    
    const duplicateCheck = await sql`
      SELECT 
        name_en, 
        updatetimestamp, 
        COUNT(*) as count
      FROM ships 
      WHERE updatetimestamp IS NOT NULL
      GROUP BY name_en, updatetimestamp 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 5
    `;
    
    if (duplicateCheck.length > 0) {
      console.log(`发现 ${duplicateCheck.length} 个重复组合，需要清理数据...`);
      duplicateCheck.forEach((dup, idx) => {
        console.log(`  ${idx + 1}. ${dup.name_en} - ${dup.updatetimestamp} (重复${dup.count}次)`);
      });
    } else {
      console.log('✓ 没有发现重复的(name_en, updatetimestamp)组合');
    }

    // 3. 执行所有更新操作
    console.log('\n=== 3. 执行更新操作 ===');
    
    await sql.begin(async (sql) => {
      // 3.1 清理重复数据
      if (duplicateCheck.length > 0) {
        console.log('3.1 清理重复数据...');
        
        const deleteResult = await sql`
          DELETE FROM ships 
          WHERE ctid IN (
            SELECT ctid FROM (
              SELECT ctid,
                     ROW_NUMBER() OVER (
                       PARTITION BY name_en, updatetimestamp 
                       ORDER BY created_at
                     ) as rn
              FROM ships
              WHERE updatetimestamp IS NOT NULL
            ) ranked
            WHERE rn > 1
          )
        `;
        
        console.log(`✓ 已删除 ${deleteResult.count || 0} 条重复记录`);
      }

      // 3.2 修改staticinfoupdatetime列允许NULL
      console.log('3.2 修改staticinfoupdatetime列允许NULL...');
      await sql`ALTER TABLE Ships ALTER COLUMN staticinfoupdatetime DROP NOT NULL`;
      console.log('✓ staticinfoupdatetime列已修改为允许NULL');

      // 3.3 删除现有主键约束
      if (currentPK.length > 0) {
        console.log('3.3 删除现有主键约束...');
        const constraintName = currentPK[0].constraint_name;
        await sql`ALTER TABLE Ships DROP CONSTRAINT ${sql(constraintName)}`;
        console.log(`✓ 已删除主键约束: ${constraintName}`);
      }

      // 3.4 添加新的主键约束
      console.log('3.4 添加新的主键约束...');
      await sql`ALTER TABLE Ships ADD PRIMARY KEY (name_en, updatetimestamp)`;
      console.log('✓ 成功添加新主键约束 (name_en, updatetimestamp)');

      console.log('✓ 所有更新操作已完成');
    });

    // 4. 验证更新结果
    console.log('\n=== 4. 验证更新结果 ===');
    
    // 4.1 验证主键约束
    const newPK = await sql`
      SELECT 
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'ships' 
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `;
    
    if (newPK.length > 0) {
      console.log('新的主键约束:');
      newPK.forEach((pk, index) => {
        console.log(`  ${index + 1}. ${pk.column_name}`);
      });
    }

    // 4.2 验证列约束
    const staticInfoAfter = await sql`
      SELECT is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ships' AND column_name = 'staticinfoupdatetime'
    `;
    
    if (staticInfoAfter.length > 0) {
      console.log(`staticinfoupdatetime列允许NULL: ${staticInfoAfter[0].is_nullable === 'YES' ? '是' : '否'}`);
    }

    // 4.3 验证重复数据清理
    const remainingDuplicates = await sql`
      SELECT 
        name_en, 
        updatetimestamp, 
        COUNT(*) as count
      FROM ships 
      WHERE updatetimestamp IS NOT NULL
      GROUP BY name_en, updatetimestamp 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 5
    `;
    
    if (remainingDuplicates.length === 0) {
      console.log('✓ 重复数据清理验证通过');
    } else {
      console.log(`⚠ 仍有 ${remainingDuplicates.length} 个重复组合`);
    }

    // 4.4 测试主键约束功能
    console.log('\n=== 5. 测试主键约束功能 ===');
    
    try {
      const testRecord = await sql`
        SELECT name_en, updatetimestamp, longitude, latitude, area
        FROM ships 
        WHERE updatetimestamp IS NOT NULL
        LIMIT 1
      `;
      
      if (testRecord.length > 0) {
        const record = testRecord[0];
        console.log('测试主键约束：尝试插入重复数据...');
        
        await sql`
          INSERT INTO ships (name_en, name_zh, updatetimestamp, longitude, latitude, area)
          VALUES (${record.name_en}, '测试船', ${record.updatetimestamp}, ${record.longitude}, ${record.latitude}, ${record.area})
        `;
        
        console.log('❌ 主键约束测试失败：应该阻止重复数据插入');
      }
    } catch (insertError) {
      if (insertError.code === '23505') { // 唯一性约束违反
        console.log('✓ 主键约束测试通过：成功阻止重复数据插入');
        console.log(`  错误信息: ${insertError.detail || insertError.message}`);
      } else {
        console.log(`⚠ 插入测试出现其他错误: ${insertError.message}`);
      }
    }

    // 5. 最终总结
    console.log('\n=== 6. 最终总结 ===');
    
    const isStaticInfoNullable = staticInfoAfter[0]?.is_nullable === 'YES';
    const hasCorrectPK = newPK.length === 2 && 
                         newPK.some(pk => pk.column_name === 'name_en') && 
                         newPK.some(pk => pk.column_name === 'updatetimestamp');
    const noDuplicates = remainingDuplicates.length === 0;
    
    console.log(`1. staticinfoupdatetime列允许NULL: ${isStaticInfoNullable ? '✓' : '❌'}`);
    console.log(`2. 主键约束为(name_en, updatetimestamp): ${hasCorrectPK ? '✓' : '❌'}`);
    console.log(`3. 重复数据已清理: ${noDuplicates ? '✓' : '❌'}`);
    
    if (isStaticInfoNullable && hasCorrectPK && noDuplicates) {
      console.log('\n🎉 所有要求的更改都已完成！');
      console.log('\n📊 更新后的表结构:');
      console.log('   - 主键: (name_en, updatetimestamp)');
      console.log('   - staticinfoupdatetime列: 允许NULL，默认值CURRENT_TIMESTAMP');
      console.log('   - 数据完整性: 已确保(name_en, updatetimestamp)组合唯一');
    } else {
      console.log('\n⚠️  部分要求未完成，请检查上述结果');
    }

  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    throw error;
  } finally {
    await sql.end();
    console.log('\n数据库连接已关闭');
  }
}

// 执行更新
if (require.main === module) {
  console.log('⚠️  警告: 此操作将修改数据库表结构，请确保已备份数据库！');
  console.log('按 Ctrl+C 取消，或等待 3 秒后自动开始...');
  
  setTimeout(async () => {
    updateShipTableFinal()
      .then(() => {
        console.log('\n🎉 Ships表更新完成！');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Ships表更新失败:', error);
        process.exit(1);
      });
  }, 3000);
}

module.exports = { updateShipTableFinal }; 