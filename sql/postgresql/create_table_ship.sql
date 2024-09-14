CREATE TABLE Ships (
  name_en VARCHAR(32) NOT NULL,
  name_zh VARCHAR(32) NOT NULL,
  longitude DECIMAL(9,6),
  latitude DECIMAL(9,6),
  area INTEGER,
  updatetimestamp TIMESTAMP,
  updatetimeformat VARCHAR(32),
  staticinfoupdatetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (name_en, staticinfoupdatetime)
);

CREATE INDEX idx_name_en ON Ships (name_en);
CREATE INDEX idx_name_zh ON Ships (name_zh);