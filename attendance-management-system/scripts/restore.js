// Restore a backup only after the application is stopped. Requires an explicit path.
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const root = path.resolve(__dirname, '..');
const input = process.argv[2];
if (!input) { console.error('Usage: npm run db:restore -- <path-to-backup.db>'); process.exit(1); }
const backup = path.resolve(process.cwd(), input);
const target = path.join(root, 'database', 'attendance.db');
if (!fs.existsSync(backup)) { console.error(`Backup file not found: ${backup}`); process.exit(1); }
if (backup === target) { console.error('Source and destination are the same file.'); process.exit(1); }
fs.mkdirSync(path.dirname(target), { recursive: true });
const source = new sqlite3.Database(backup, sqlite3.OPEN_READONLY);
source.get('PRAGMA integrity_check', (err, row) => {
  if (err || !row || row.integrity_check !== 'ok') {
    console.error('Backup integrity check failed; database was not restored.');
    source.close(); process.exitCode = 1; return;
  }
  const destination = new sqlite3.Database(target);
  source.backup(destination, backupErr => {
    destination.close(); source.close();
    if (backupErr) { console.error('Restore failed:', backupErr.message); process.exitCode = 1; }
    else console.log(`Restored database from ${backup}. Restart the application.`);
  });
});
