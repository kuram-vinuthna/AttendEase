const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Public self-registration is student-only. Faculty/admin accounts are created by an administrator.
router.post('/register', (req, res) => {
  const { name, email, password, role = 'student', roll_no } = req.body;
  if (role !== 'student') return res.status(403).json({ error: 'Faculty accounts must be created by an administrator.' });
  if (!name || !email || !password || !roll_no) return res.status(400).json({ error: 'Name, email, password and college roll number are required.' });
  if (String(name).trim().length > 120 || String(email).trim().length > 254 || !/^\S+@\S+\.\S+$/.test(String(email).trim())) return res.status(400).json({ error: 'Enter a valid name and email address.' });
  if (String(password).length < 1 || String(password).length > 128) return res.status(400).json({ error: 'Password must contain 1–128 characters.' });
  const db = req.app.get('db');
  const create = async () => {
    const student = await new Promise((resolve, reject) => db.get('SELECT id,name,email FROM students WHERE roll_no=?', [String(roll_no).trim()], (e,r) => e ? reject(e) : resolve(r)));
    if (!student || String(student.email || '').toLowerCase() !== String(email).trim().toLowerCase()) return res.status(400).json({ error: 'Roll number and registered student email do not match. Ask faculty to update your student record.' });
    const linkedAccount = await new Promise((resolve,reject) => db.get('SELECT id FROM users WHERE student_id=?',[student.id],(e,r)=>e?reject(e):resolve(r)));
    if (linkedAccount) return res.status(409).json({ error: 'A portal account already exists for this student. Contact your administrator if you need account help.' });
    const hash = await bcrypt.hash(String(password), 12);
    db.run('INSERT INTO users (name,email,password_hash,role,student_id) VALUES (?,?,?,?,?)', [String(name).trim(),String(email).trim().toLowerCase(),hash,'student',student.id], function(err) {
      if (err) return res.status(409).json({ error: 'An account already exists or this student already has an account.' });
      req.session.regenerate(regErr => {
        if (regErr) return res.status(500).json({ error: 'Unable to start session.' });
        req.session.user = { id:this.lastID, name:String(name).trim(), email:String(email).trim().toLowerCase(), role:'student', student_id:student.id };
        res.status(201).json({ok:true,user:req.session.user});
      });
    });
  };
  create().catch(() => res.status(500).json({error:'Could not create account.'}));
});
router.post('/login', (req,res) => {
  const {email,password} = req.body;
  if (!email || !password || String(email).length > 254 || String(password).length > 128) return res.status(400).json({error:'Enter a valid email and password.'});
  req.app.get('db').get('SELECT * FROM users WHERE email=?',[String(email).trim().toLowerCase()],async(err,user)=>{
    let valid=false; try { valid=!!user && await bcrypt.compare(String(password),user.password_hash); } catch {}
    if(err || !valid) return res.status(401).json({error:'Invalid email or password.'});
    req.session.regenerate(regErr=>{if(regErr)return res.status(500).json({error:'Unable to start session.'});req.session.user={id:user.id,name:user.name,email:user.email,role:user.role,student_id:user.student_id||null};res.json({ok:true,user:req.session.user});});
  });
});
router.get('/me',requireAuth,(req,res)=>res.json({user:req.session.user}));
router.post('/logout',(req,res)=>req.session.destroy(err=>{res.clearCookie('connect.sid');if(err)return res.status(500).json({error:'Could not log out.'});res.json({ok:true});}));
module.exports=router;
