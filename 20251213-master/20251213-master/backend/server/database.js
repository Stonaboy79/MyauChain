const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'stays.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS stays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userAddress TEXT,
        lat REAL,
        lng REAL,
        startTime INTEGER,
        endTime INTEGER,
        status TEXT,
        earnedTokens REAL
    )`);
});

module.exports = db;
