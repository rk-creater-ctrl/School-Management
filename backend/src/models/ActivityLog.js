const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: String,
    action: { type: String, required: true },
    module: { type: String, required: true },
    entityId: String,
    ipAddress: String,
    userAgent: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

activityLogSchema.index({ module: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
