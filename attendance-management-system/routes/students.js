const router = require('express').Router();
const { requireStaff } = require('../middleware/auth');
router.use(requireStaff);
router.get('/', (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  req.app.get('db').all(
    'SELECT s.*, (SELECT COUNT(*) FROM attendance a WHERE a.student_id=s.id AND a.status IN ("Present","Late")) AS present_count, (SELECT COUNT(*) FROM attendance a WHERE a.student_id=s.id) AS total_count FROM students s WHERE s.name LIKE ? OR s.roll_no LIKE ? OR s.department LIKE ? ORDER BY s.roll_no',
    [q,q,q], (err, rows) => err ? res.status(500).json({error:'Could not load students.'}) : res.json(rows));
});
router.get('/:id', (req,res) => {
  req.app.get('db').get('SELECT * FROM students WHERE id=?',[req.params.id],(err,row)=> {
    if(err) return res.status(500).json({error:'Database error.'});
    if(!row) return res.status(404).json({error:'Student not found.'});
    req.app.get('db').all('SELECT date,status FROM attendance WHERE student_id=? ORDER BY date DESC',[row.id],(e,attendance)=>res.json({...row,attendance:attendance||[]}));
  });
});
router.post('/import', (req,res) => {
 const rows=req.body.students; if(!Array.isArray(rows)||!rows.length||rows.length>1000)return res.status(400).json({error:'Provide between 1 and 1000 students.'});
 const normalized=rows.map(r=>({roll_no:String(r.roll_no||'').trim(),name:String(r.name||'').trim(),email:String(r.email||'').trim(),department:String(r.department||'').trim(),year:String(r.year||'').trim(),phone:String(r.phone||'').trim()}));
 if(normalized.some(r=>!r.roll_no||!r.name||r.roll_no.length>50||r.name.length>120||r.email.length>254)||new Set(normalized.map(r=>r.roll_no)).size!==normalized.length)return res.status(400).json({error:'Each row needs a unique roll number and name; check field lengths.'});
 const db=req.app.get('db');db.serialize(()=>{db.run('BEGIN');let failed=false;const st=db.prepare('INSERT INTO students(roll_no,name,email,department,year,phone) VALUES(?,?,?,?,?,?)');normalized.forEach(r=>st.run([r.roll_no,r.name,r.email,r.department,r.year,r.phone],e=>{if(e)failed=true;}));st.finalize(e=>{if(e||failed)return db.run('ROLLBACK',()=>res.status(409).json({error:'Import failed. Check for existing roll numbers and correct the file; no rows were imported.'}));db.run('COMMIT',e2=>e2?res.status(500).json({error:'Could not finish import.'}):res.status(201).json({ok:true,imported:normalized.length}));});});
});
router.post('/', (req,res) => {
  const {roll_no,name,email='',department='',year='',phone=''} = req.body;
  if(!roll_no || !name) return res.status(400).json({error:'Roll number and student name are required.'});
  req.app.get('db').run('INSERT INTO students (roll_no,name,email,department,year,phone) VALUES (?,?,?,?,?,?)',
    [String(roll_no).trim(),String(name).trim(),String(email).trim(),String(department).trim(),String(year).trim(),String(phone).trim()],
    function(err){ if(err) return res.status(409).json({error:'Roll number already exists or details are invalid.'}); res.status(201).json({id:this.lastID,ok:true}); });
});
router.put('/:id', (req,res) => {
  const {roll_no,name,email='',department='',year='',phone=''}=req.body;
  if(!roll_no || !name) return res.status(400).json({error:'Roll number and name are required.'});
  req.app.get('db').run('UPDATE students SET roll_no=?,name=?,email=?,department=?,year=?,phone=? WHERE id=?',
    [roll_no,name,email,department,year,phone,req.params.id],function(err){if(err)return res.status(409).json({error:'Could not update student; check roll number.'});if(!this.changes)return res.status(404).json({error:'Student not found.'});res.json({ok:true});});
});
router.delete('/:id', (req,res) => req.app.get('db').run('DELETE FROM students WHERE id=?',[req.params.id],function(err){if(err)return res.status(500).json({error:'Could not delete student.'});if(!this.changes)return res.status(404).json({error:'Student not found.'});res.json({ok:true});}));
module.exports = router;
