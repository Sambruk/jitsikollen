const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db-data', 'diagnostics.sqlite');

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

const insertResult = db.prepare(`
  INSERT INTO test_results (id, organization, timestamp, total_score, rating, results_json, user_agent, ip_address)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getResult = db.prepare('SELECT * FROM test_results WHERE id = ?');
const getResultsByOrg = db.prepare('SELECT id, organization, timestamp, total_score, rating FROM test_results WHERE organization = ? ORDER BY timestamp DESC LIMIT 50');
const getRecentResults = db.prepare('SELECT id, organization, timestamp, total_score, rating FROM test_results ORDER BY timestamp DESC LIMIT 50');

module.exports = {
  db,
  insertResult,
  getResult,
  getResultsByOrg,
  getRecentResults
};
