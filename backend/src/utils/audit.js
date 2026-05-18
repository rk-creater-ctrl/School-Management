const ActivityLog = require('../models/ActivityLog');

async function writeActivity(req, action, module, entityId, metadata = {}) {
  try {
    await ActivityLog.create({
      actor: req.user?._id,
      actorRole: req.user?.role,
      action,
      module,
      entityId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata,
    });
  } catch (error) {
    console.error('Activity log failed:', error.message);
  }
}

module.exports = { writeActivity };
