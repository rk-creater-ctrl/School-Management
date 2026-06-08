// BACKUP: created before authorize() behavior change

const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authenticate(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token, access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.status !== 'active') return res.status(403).json({ error: 'User is not active' });

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'superadmin') return next();
    if (!hasAnyAccess(req.user, roles)) {
      return res.status(403).json({ error: 'You do not have permission for this action' });
    }
    next();
  };
}

function hasAnyAccess(user, roles = []) {
  const allowed = roles.map((role) => String(role || '').toLowerCase().trim()).filter(Boolean);
  const effectiveRoles = [
    user.role,
    ...(Array.isArray(user.permissions) ? user.permissions : []),
  ]
    .map((role) => String(role || '').toLowerCase().trim())
    .filter((role, index) => index === 0 || role !== 'superadmin');

  return allowed.some((role) => effectiveRoles.includes(role));
}

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.authorize = authorize;
