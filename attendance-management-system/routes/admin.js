const router=require('express').Router();
const bcrypt=require('bcryptjs');
const {requireAdmin}=require('../middleware/auth');
router.use(requireAdmin);
router.get('/stats',(req,res)=>req.app.get('db').get(`SELECT (SELECT COUNT(*) FROM students) students,(SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM users WHERE role='teacher') teachers,(SELECT COUNT(*) FROM subjects) subjects,(SELECT COUNT(*) FROM attendance WHERE date=date('now','localtime')) marked_today,(SELECT COUNT(*) FROM attendance WHERE date=date('now','localtime') AND status IN ('Present','Late')) present_today`,(e,r)=>e?res.status(500).json({error:'Could not load admin statistics.'}):res.json(r)));
router.get('/users',(req,res)=>req.app.get('db').all("SELECT id,name,email,role,created_at FROM users WHERE role != 'student' ORDER BY id DESC",(e,r)=>e?res.status(500).json({error:'Could not load users.'}):res.json(r)));
router.post('/users',(req,res)=>{
 const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
 if(!name||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return res.status(400).json({error:'Enter a valid name and email.'});
 if(password.length<8||password.length>128)return res.status(400).json({error:'Password must contain 8–128 characters.'});
 bcrypt.hash(password,12).then(hash=>req.app.get('db').run('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)',[name,email,hash,'teacher'],function(e){if(e)return res.status(409).json({error:'That email is already registered.'});res.status(201).json({ok:true,id:this.lastID});})).catch(()=>res.status(500).json({error:'Could not create faculty account.'}));
});
router.put('/users/:id/role',(req,res)=>{const role=req.body.role;if(!['admin','teacher'].includes(role))return res.status(400).json({error:'Invalid role.'});if(Number(req.params.id)===req.session.user.id&&role!=='admin')return res.status(400).json({error:'You cannot remove your own admin role.'});req.app.get('db').run('UPDATE users SET role=? WHERE id=?',[role,req.params.id],function(e){if(e)return res.status(500).json({error:'Could not update role.'});if(!this.changes)return res.status(404).json({error:'User not found.'});res.json({ok:true});});});
module.exports=router;
