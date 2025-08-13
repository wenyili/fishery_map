-- 修改staticinfoupdatetime列允许为NULL
ALTER TABLE Ships ALTER COLUMN staticinfoupdatetime DROP NOT NULL;

-- 删除现有的主键约束
ALTER TABLE Ships DROP CONSTRAINT Ships_pkey;

-- 添加新的主键约束
ALTER TABLE Ships ADD PRIMARY KEY (name_en, updatetimestampss); 