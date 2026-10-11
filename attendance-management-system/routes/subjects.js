const router = require('express').Router();
const { requireStaff, requireAdmin } = require('../middleware/auth');
router.use(requireStaff);
router.get('/', (req,res)=>req.app.get('db').all('SELECT * FROM subjects ORDER BY department,semester,code',(e,rows)=>e?res.status(500).json({error:'Could not load subjects.'}):res.json(rows)));
router.post('/', requireAdmin, (req,res)=>{
 const {code,name,department='',semester=''}=req.body;
 if(!String(code||'').trim()||!String(name||'').trim())return res.status(400).json({error:'Subject code and name are required.'});
 req.app.get('db').run('INSERT INTO subjects(code,name,department,semester) VALUES(?,?,?,?)',[String(code).trim().toUpperCase(),String(name).trim(),String(department).trim(),String(semester).trim()],function(e){if(e)return res.status(409).json({error:'Subject code already exists or is invalid.'});res.status(201).json({id:this.lastID,ok:true});});
});
router.delete('/:id', requireAdmin, (req,res)=>req.app.get('db').run('DELETE FROM subjects WHERE id=?',[req.params.id],function(e){if(e)return res.status(500).json({error:'Could not delete subject.'});if(!this.changes)return res.status(404).json({error:'Subject not found.'});res.json({ok:true});}));
module.exports=router;
