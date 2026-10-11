const router = require('express').Router();
const { requireAuth, requireStaff } = require('../middleware/auth');
router.use(requireAuth);
router.get('/', (req,res) => {
 if(req.session.user.role==='student')return res.status(403).json({error:'Use your student portal to view personal attendance.'});
 const date=String(req.query.date||new Date().toISOString().slice(0,10)); const subjectId=req.query.subject_id?Number(req.query.subject_id):null;
 const sql=`SELECT s.id,s.roll_no,s.name,s.department,a.status,a.date FROM students s LEFT JOIN attendance a ON a.student_id=s.id AND a.date=? AND ((? IS NULL AND a.subject_id IS NULL) OR a.subject_id=?) ORDER BY s.roll_no`;
 req.app.get('db').all(sql,[date,subjectId,subjectId],(err,rows)=>err?res.status(500).json({error:'Could not load attendance.'}):res.json({date,subject_id:subjectId,students:rows}));
});
router.post('/mark', requireStaff, (req,res) => {
 const {date,records,subject_id=null}=req.body;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||Number.isNaN(Date.parse(String(date)+'T00:00:00Z'))||new Date(String(date)+'T00:00:00Z').toISOString().slice(0,10)!==String(date)||!Array.isArray(records)||records.length>2000)return res.status(400).json({error:'A valid date and attendance records are required.'});
 const db=req.app.get('db');const subject=subject_id===null||subject_id===''?null:Number(subject_id);
 if(subject!==null&&(!Number.isInteger(subject)||subject<1))return res.status(400).json({error:'Invalid subject.'});
 const ids=records.map(r=>Number(r.student_id)); if(new Set(ids).size!==ids.length)return res.status(400).json({error:'Duplicate student records are not allowed.'});
 if(subject!==null){return db.get('SELECT id FROM subjects WHERE id=?',[subject],(e,row)=>{if(e)return res.status(500).json({error:'Could not validate subject.'});if(!row)return res.status(400).json({error:'Selected subject does not exist.'});saveRecords();});}
 saveRecords();
 function saveRecords(){
 db.serialize(()=>{db.run('BEGIN TRANSACTION');let failed=false;const sql=subject===null?`INSERT INTO attendance(student_id,subject_id,date,status,marked_by) VALUES(?,NULL,?,?,?) ON CONFLICT(student_id,date) WHERE subject_id IS NULL DO UPDATE SET status=excluded.status,marked_by=excluded.marked_by`:`INSERT INTO attendance(student_id,subject_id,date,status,marked_by) VALUES(?,?,?,?,?) ON CONFLICT(student_id,date,subject_id) WHERE subject_id IS NOT NULL DO UPDATE SET status=excluded.status,marked_by=excluded.marked_by`;
 const stmt=db.prepare(sql);records.forEach(r=>{if(!Number.isInteger(Number(r.student_id))||!['Present','Absent','Late','Leave'].includes(r.status)){failed=true;return;}const values=subject===null?[Number(r.student_id),date,r.status,req.session.user.id]:[Number(r.student_id),subject,date,r.status,req.session.user.id];stmt.run(values,err=>{if(err)failed=true;});});
 stmt.finalize(err=>{if(err||failed)return db.run('ROLLBACK',()=>res.status(400).json({error:'Some attendance records were invalid.'}));db.run('COMMIT',e=>e?res.status(500).json({error:'Could not save attendance.'}):res.json({ok:true,count:records.length}));});});
 }
});
router.get('/report',(req,res)=>{
 const {from,to,student_id,subject_id}=req.query;let sql=`SELECT a.date,a.status,s.id AS student_id,s.roll_no,s.name,s.department,sub.code AS subject_code,sub.name AS subject_name FROM attendance a JOIN students s ON s.id=a.student_id LEFT JOIN subjects sub ON sub.id=a.subject_id WHERE a.date BETWEEN ? AND ?`;const params=[from||'1900-01-01',to||'2999-12-31'];
 if(student_id){sql+=' AND s.id=?';params.push(student_id);}if(subject_id){sql+=' AND a.subject_id=?';params.push(subject_id);}if(req.session.user.role==='student'){sql+=' AND s.id=?';params.push(req.session.user.student_id||-1);}sql+=' ORDER BY a.date DESC,s.roll_no';
 req.app.get('db').all(sql,params,(err,rows)=>err?res.status(500).json({error:'Could not generate report.'}):res.json(rows));
});
router.get('/alerts',requireStaff,(req,res)=>{const threshold=Math.min(100,Math.max(1,Number(req.query.threshold)||75));req.app.get('db').all(`SELECT s.id,s.roll_no,s.name,s.department,sub.id subject_id,COALESCE(sub.code,'General') subject_code,COALESCE(sub.name,'General / no subject') subject_name,COUNT(a.id) total,SUM(CASE WHEN a.status IN ('Present','Late') THEN 1 ELSE 0 END) present,ROUND(100.0*SUM(CASE WHEN a.status IN ('Present','Late') THEN 1 ELSE 0 END)/COUNT(a.id),1) rate FROM students s JOIN attendance a ON a.student_id=s.id LEFT JOIN subjects sub ON sub.id=a.subject_id GROUP BY s.id,sub.id HAVING rate < ? ORDER BY rate ASC,s.roll_no`,[threshold],(e,rows)=>e?res.status(500).json({error:'Could not calculate low-attendance alerts.'}):res.json({threshold,students:rows}));});
module.exports=router;
