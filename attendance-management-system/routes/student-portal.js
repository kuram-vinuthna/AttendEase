const router=require('express').Router();
const {requireAuth}=require('../middleware/auth');
router.use(requireAuth,(req,res,next)=>req.session.user.role==='student'?next():res.status(403).json({error:'Student portal access only.'}));
router.get('/me',(req,res)=>{
 const db=req.app.get('db'), id=req.session.user.student_id;
 if(!id)return res.status(404).json({error:'Student profile is not linked.'});
 db.get('SELECT id,roll_no,name,email,department,year,phone FROM students WHERE id=?',[id],(e,s)=>{
  if(e||!s)return res.status(404).json({error:'Student profile not found.'});
  db.all(`SELECT a.date,a.status,sub.id subject_id,sub.code subject_code,sub.name subject_name FROM attendance a LEFT JOIN subjects sub ON sub.id=a.subject_id WHERE a.student_id=? ORDER BY a.date DESC,a.id DESC`,[id],(err,rows)=>{
   if(err)return res.status(500).json({error:'Could not load attendance.'});
   const attended=r=>r.status==='Present'||r.status==='Late';
   const total=rows.length,present=rows.filter(attended).length;
   const bySubject=new Map(); rows.forEach(r=>{const k=r.subject_id??'general';if(!bySubject.has(k))bySubject.set(k,{subject_id:r.subject_id,subject_code:r.subject_code||'General',subject_name:r.subject_name||'General / no subject',total:0,present:0});const x=bySubject.get(k);x.total++;if(attended(r))x.present++;});
   const subjects=[...bySubject.values()].map(x=>({...x,rate:x.total?Math.round(x.present/x.total*1000)/10:0}));
   res.json({...s,attendance:rows.slice(0,100),total,present,rate:total?Math.round(present/total*1000)/10:0,threshold:75,subjects});
  });
 });
});
module.exports=router;
