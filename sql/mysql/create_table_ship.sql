CREATE TABLE Ships (
    name_en VARCHAR(32) NOT NULL,
    name_zh VARCHAR(32) NOT NULL,
    longitude DECIMAL(9,6),
    latitude DECIMAL(9,6),
    staticinfoupdatetime TIMESTAMP NOT NULL,
    updatetimeformat VARCHAR(32),
    PRIMARY KEY (name_en, staticinfoupdatetime),
    INDEX (name_en),
    INDEX (name_zh)
) CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;