CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  organization TEXT,
  timestamp TEXT NOT NULL,
  total_score REAL NOT NULL,
  rating TEXT NOT NULL,
  results_json TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_results_timestamp ON test_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_results_organization ON test_results(organization);
