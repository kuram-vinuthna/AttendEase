function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
  next();
}
function requireStaff(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
  if (req.session.user.role === 'student') return res.status(403).json({ error: 'Faculty access required.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}
module.exports = { requireAuth, requireStaff, requireAdmin };
