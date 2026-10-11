// Creates a consistent SQLite backup using SQLite's online backup API.
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'database', 'attendance.db');
const backupDir = path.join(root, 'backups');
if (!fs.existsSync(sourcePath)) { console.error(`Database not found: ${sourcePath}`); process.exit(1); }
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(backupDir, `attendance-${stamp}.db`);
const source = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY);
source.backup(destination, err => {
  source.close();
  if (err) { console.error('Backup failed:', err.message); process.exitCode = 1; return; }
  console.log(`Backup created: ${destination}`);
  console.log('Keep a copy outside this project folder for disaster recovery.');
});
