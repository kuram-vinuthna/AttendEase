# AttendEase — College Attendance Management System (Upgraded)

A full-stack college attendance application built with Node.js, Express, SQLite, HTML, CSS and vanilla JavaScript. It includes a professional responsive dashboard, student/faculty/admin workflows, subject-wise attendance, low-attendance alerts and downloadable reports.

## Features
- Responsive dashboard with daily attendance KPIs and weekly trends
- Student CRUD, search, detail pages, attendance history and CSV bulk import (up to 1,000 records)
- Separate student portal with full-history and subject-wise attendance rates, alerts and Excel download
- Subject catalogue and subject-specific attendance marking; multiple subjects can be marked on the same date
- Attendance statuses: Present, Absent, Late and Leave; Present and Late count as attended
- Date/subject-filtered reports with CSV, PDF and Excel exports
- Subject-wise low-attendance alerts (75% default)
- Administrator dashboard, faculty account creation and role management
- Password hashing with bcrypt, login/registration rate limiting, session regeneration, production cookie settings, input limits and basic security headers
- Additive SQLite migration retains existing student and attendance records where possible

## Requirements
- Node.js 18 or later (Node.js 20 LTS recommended)
- VS Code

## Setup in VS Code (Windows)
1. Extract `attendance-management-system-upgraded.zip`.
2. Open the extracted `attendance-management-system` folder in VS Code (**File → Open Folder**).
3. Open **Terminal → New Terminal**.
4. Run `npm install` and wait for it to finish.
5. Run `npm start`.
6. Open `http://localhost:3000` in your browser.

If installation fails, confirm Node.js is installed (`node -v` and `npm -v`) and retry `npm install` with a working internet connection. Do not copy `node_modules` from another computer.

## First login
For a fresh local database, the app seeds this development administrator if no admin exists:
- Email: `admin@sa.com`
- Password: `Admin@123`

Change demo passwords before using real student data. On first start, the app creates these demo faculty and student accounts if they do not already exist. Existing account passwords are not overwritten.

### Demo login credentials
- **Admin:** `admin@sa.com` / `Admin@123`
- **Faculty:** `priya.faculty@sa.com` / `priya.faculty`; `rahul.faculty@sa.com` / `rahul.faculty`; `ananya.faculty@sa.com` / `ananya.faculty`; `sandeep.faculty@sa.com` / `sandeep.faculty`; `kavitha.faculty@sa.com` / `kavitha.faculty`; `manoj.faculty@sa.com` / `manoj.faculty`; `divya.faculty@sa.com` / `divya.faculty`
- **Students:** use `firstname@sa.com` as the email and `firstname` as the password (for example, `aarav@sa.com` / `aarav`, `priya@sa.com` / `priya`). Student portal accounts are linked to the seeded student roster. The demo database includes 16 student records and subject-wise sample attendance entries for all students, including the newly added students Arjun, Divya, Rohan, Kavya, Ishaan, Pooja, Neha and Aditya.

These short demo passwords are intentionally easy for a classroom demo and are not safe for real deployment. Back up `database/attendance.db` before upgrading or replacing the ZIP.

## Student accounts
1. Sign in as faculty/admin and add a student with a unique roll number and email.
2. Sign out and visit `http://localhost:3000/student-register`.
3. Register using the exact existing roll number and matching email.
4. Students can only access their linked profile and attendance portal. For the seeded demo students, use the credentials above; for new students, use the configured college email and roll number.

Public faculty registration is disabled. An administrator signs in, opens **Admin panel**, and creates faculty accounts there. Share temporary credentials securely and ask faculty to change their password (password-change UI is not included in this version).

## Subjects, attendance and reports
1. Open **Subjects** and add subjects as an administrator.
2. Open **Mark attendance**, select a date and subject, set each student's status and save.
3. Open **Reports** to select dates and subject, inspect subject-wise low-attendance alerts, or export CSV/PDF/Excel.
4. On **Students**, use **Import CSV** (a sample is included at `templates/students-import-template.csv`). Required headers are `roll_no,name`; optional headers are `email,department,year,phone`. Duplicate roll numbers make the entire import fail without partial insertion.

Legacy attendance rows are migrated to **General / no subject**. Days without an attendance record are not automatically counted as absences.

## Production security notes
This is an educational project, not yet a production-hardened deployment. For production:
- Set `SESSION_SECRET` to a cryptographically random secret of at least 32 characters and set `NODE_ENV=production` behind HTTPS.
- Replace Express's default in-memory session store with a persistent production session store.
- Configure CSRF protection, password change/reset, account lockout and audit logs.
- Set up database backups, restore testing, monitoring and restricted database/file permissions.
- Never deploy with the demo administrator password or real personal data in a public demo.

PowerShell example for local testing (use a long random value):
```powershell
$env:SESSION_SECRET = "replace-with-a-random-secret-of-at-least-32-characters"
npm start
```
Leave `NODE_ENV` unset for local HTTP development; production mode requires a strong secret and secure cookies.

## Advanced upgrade additions (v4)
- `/health` readiness endpoint checks that SQLite responds.
- Same-origin checks reject browser state-changing requests with a mismatched Origin or `Sec-Fetch-Site: cross-site`.
- SQLite indexes improve date, student, subject and roll-number lookups.
- Automated unit tests: `npm test`; syntax checks: `npm run check`.
- Database backup: `npm run db:backup`. Backups are timestamped under `backups/`; copy them off-device regularly.
- Database restore: stop the app first, then run `npm run db:restore -- "C:\\path\\to\\attendance-backup.db"`. Restore validates SQLite integrity before copying. Back up the current database before restore.
- Docker deployment template: `docker build -t attendease .` then run with a persistent volume for `/app/database` and environment variables `SESSION_SECRET` and `NODE_ENV=production`. Use HTTPS via a reverse proxy and do not expose the database file.
- GitHub Actions workflow runs syntax checks and unit tests on pushes and pull requests.

### Security and deployment checklist
1. Set `SESSION_SECRET` to a random value of at least 32 characters; never commit `.env`.
2. Do not use demo passwords or sample student records for real deployments; reset all demo credentials and remove demo data first.
3. Replace Express's in-memory session store with a persistent store before multi-instance or production deployment.
4. Add a supported password-change/reset flow, stronger password policy, administrator audit log, and reviewed CSRF protection before handling real student data.
5. Configure HTTPS, secure headers/CSP after checking inline scripts, restricted database permissions, monitoring, automated off-site backups, and periodic restore drills.
6. SQLite works best for a single application instance with persistent storage. For multi-instance deployments, migrate to PostgreSQL and use a shared session store.

The included same-origin check is a useful additional layer, not a substitute for a full CSRF token strategy in every deployment architecture. The Dockerfile and CI workflow are templates and should be exercised in your target hosting environment before production use.
