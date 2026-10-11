const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('Production requires SESSION_SECRET with at least 32 characters.');
}
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new sqlite3.Database(path.join(dbDir, 'attendance.db'));

app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');next();});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'local-development-secret-change-before-deployment',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.set('db', db);
// Basic same-origin protection for browser state-changing requests. API clients without
// an Origin header remain supported; browsers sending a cross-site Origin are rejected.
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin request blocked.' });
    } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
  }
  if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-site request blocked.' });
  next();
});
app.get('/health', (req, res) => {
  db.get('SELECT 1 AS ok', (err) => {
    if (err) return res.status(503).json({ status: 'unhealthy' });
    res.json({ status: 'ok', service: 'attendease' });
  });
});
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    student_id INTEGER UNIQUE REFERENCES students(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    department TEXT DEFAULT '',
    year TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Leave')),
    marked_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, date),
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(marked_by) REFERENCES users(id)
  )`);
  // Additive migrations keep existing databases and accounts intact.
  db.run('ALTER TABLE users ADD COLUMN student_id INTEGER', () => {});
  db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    department TEXT DEFAULT '',
    semester TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS attendance_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Leave')),
    marked_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY(marked_by) REFERENCES users(id),
    UNIQUE(student_id,date,subject_id)
  )`);
  // Copy existing records once, then make the upgraded table the active attendance table.
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance'", (e, exists) => {
    if (!exists) return;
    db.all("PRAGMA table_info(attendance)", (err, cols) => {
      if (err) return;
      const hasSubject = cols.some(c => c.name === 'subject_id');
      if (!hasSubject) {
        db.serialize(() => {
          db.run(`INSERT OR IGNORE INTO attendance_v2(id,student_id,date,status,marked_by,created_at)
            SELECT id,student_id,date,status,marked_by,created_at FROM attendance`);
          db.run('DROP TABLE attendance');
          db.run('ALTER TABLE attendance_v2 RENAME TO attendance', () => {
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_general ON attendance(student_id,date) WHERE subject_id IS NULL');
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_subject ON attendance(student_id,date,subject_id) WHERE subject_id IS NOT NULL');
          });
        });
      } else {
        db.run('DROP TABLE attendance_v2');
        db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_general ON attendance(student_id,date) WHERE subject_id IS NULL');
        db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_subject ON attendance(student_id,date,subject_id) WHERE subject_id IS NOT NULL');
      }
    });
  });
  db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id,date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attendance_subject_date ON attendance(subject_id,date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_students_roll_no ON students(roll_no)');
  // Seed a small demo class only when the student table is empty.
  db.get('SELECT COUNT(*) AS count FROM students', (err, row) => {
    if (!err && row && row.count === 0) {
      const stmt = db.prepare('INSERT INTO students (roll_no,name,email,department,year,phone) VALUES (?,?,?,?,?,?)');
      [
        ['CS001','Aarav Sharma','aarav@sa.com','Computer Science','2nd Year','9000000001'],
        ['CS002','Priya Reddy','priya@sa.com','Computer Science','2nd Year','9000000002'],
        ['EC003','Rahul Kumar','rahul@sa.com','Electronics','3rd Year','9000000003'],
        ['IT004','Ananya Das','ananya@sa.com','Information Technology','1st Year','9000000004'],
        ['CS005','Vikram Rao','vikram@sa.com','Computer Science','2nd Year','9000000005'],
        ['IT006','Sneha Patel','sneha@sa.com','Information Technology','3rd Year','9000000006'],
        ['EC007','Kiran Reddy','kiran@sa.com','Electronics','2nd Year','9000000007'],
        ['CS008','Meera Nair','meera@sa.com','Computer Science','1st Year','9000000008']
      ].forEach(s => stmt.run(s));
      stmt.finalize();
    }
  });
  db.get('SELECT COUNT(*) AS count FROM subjects', (err, row) => {
    if (!err && row && row.count === 0) {
      const stmt = db.prepare('INSERT OR IGNORE INTO subjects(code,name,department,semester) VALUES(?,?,?,?)');
      [['CS101','Programming Fundamentals','Computer Science','1'],['CS202','Database Management Systems','Computer Science','3'],['IT201','Web Technologies','Information Technology','3']].forEach(x => stmt.run(x));
      stmt.finalize();
    }
  });
  // Demo credentials for local coursework. Change these passwords before real use.
  db.get('SELECT id FROM users WHERE email = ?', ['admin@sa.com'], async (err, admin) => {
    if (err) return console.error('Could not check demo administrator:', err.message);
    if (!admin) {
      const hash = await bcrypt.hash('Admin@123', 12);
      db.run('INSERT OR IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
        ['System Admin','admin@sa.com',hash,'admin']);
    }
    const faculty = [
      ['Priya Faculty','priya.faculty@sa.com','priya.faculty'],
      ['Rahul Faculty','rahul.faculty@sa.com','rahul.faculty'],
      ['Ananya Faculty','ananya.faculty@sa.com','ananya.faculty'],
      ['Sandeep Faculty','sandeep.faculty@sa.com','sandeep.faculty'],
      ['Kavitha Faculty','kavitha.faculty@sa.com','kavitha.faculty'],
      ['Manoj Faculty','manoj.faculty@sa.com','manoj.faculty'],
      ['Divya Faculty','divya.faculty@sa.com','divya.faculty']
    ];
    faculty.forEach(([name,email,password]) => bcrypt.hash(password,12).then(hash =>
      db.run('INSERT OR IGNORE INTO users(name,email,password_hash,role) VALUES(?,?,?,?)',[name,email,hash,'teacher'])
    ));
    const demoStudents = [
      ['Aarav Sharma','aarav@sa.com','aarav'],['Priya Reddy','priya@sa.com','priya'],
      ['Rahul Kumar','rahul@sa.com','rahul'],['Ananya Das','ananya@sa.com','ananya'],
      ['Vikram Rao','vikram@sa.com','vikram'],['Sneha Patel','sneha@sa.com','sneha'],
      ['Kiran Reddy','kiran@sa.com','kiran'],['Meera Nair','meera@sa.com','meera'],
      ['Arjun Reddy','arjun@sa.com','arjun'],['Divya Sharma','divya@sa.com','divya'],
      ['Rohan Verma','rohan@sa.com','rohan'],['Kavya Nair','kavya@sa.com','kavya'],
      ['Ishaan Gupta','ishaan@sa.com','ishaan'],['Pooja Reddy','pooja@sa.com','pooja'],
      ['Neha Kapoor','neha@sa.com','neha'],['Aditya Rao','aditya@sa.com','aditya']
    ];
    db.all('SELECT id,name,email,roll_no FROM students', async (studentErr, students) => {
      if (studentErr) return console.error('Could not seed demo student accounts:', studentErr.message);
      for (const student of students) {
        const match = demoStudents.find(item => item[1] === String(student.email || '').toLowerCase());
        if (!match) continue;
        const hash = await bcrypt.hash(match[2],12);
        db.run('INSERT OR IGNORE INTO users(name,email,password_hash,role,student_id) VALUES(?,?,?,?,?)',
          [student.name,match[1],hash,'student',student.id]);
      }
    });
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/student-register', (req,res)=>res.sendFile(path.join(__dirname,'views','student-register.html')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/student-portal', require('./routes/student-portal'));

const pages = {
  '/dashboard': 'dashboard.html',
  '/students': 'students.html',
  '/add-student': 'add-student.html',
  '/attendance': 'attendance.html',
  '/attendance-report': 'attendance-report.html',
  '/student-details': 'student-details.html',
  '/admin-dashboard': 'admin-dashboard.html',
  '/student-portal': 'student-portal.html',
  '/subjects': 'subjects.html'
};
Object.entries(pages).forEach(([route, page]) => {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'views', page)));
});
app.get('/reports/attendance.pdf', (req,res,next)=>{ if(!req.session.user) return res.status(401).send('Please log in first.'); next(); }, require('./routes/exports').pdf);
app.get('/reports/attendance.xlsx', (req,res,next)=>{ if(!req.session.user) return res.status(401).send('Please log in first.'); next(); }, require('./routes/exports').excel);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
app.listen(PORT, () => console.log(`Attendance system running at http://localhost:${PORT}`));
