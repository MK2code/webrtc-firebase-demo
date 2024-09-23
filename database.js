// database.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    offer TEXT,
    answer TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS offer_candidates (
    call_id TEXT,
    candidate TEXT,
    FOREIGN KEY(call_id) REFERENCES calls(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS answer_candidates (
    call_id TEXT,
    candidate TEXT,
    FOREIGN KEY(call_id) REFERENCES calls(id)
  )`);
});

module.exports = db;
