const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    channels: [{ type: String, enum: ['app', 'email', 'sms', 'push', 'whatsapp'] }],
    targetRoles: [{ type: String }],
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['draft', 'queued', 'sent', 'failed'], default: 'queued' },
    scheduledFor: Date,
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

notificationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
