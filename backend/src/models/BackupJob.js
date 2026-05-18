const mongoose = require('mongoose');

const backupJobSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['full', 'database', 'files'], default: 'full' },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    storageProvider: { type: String, enum: ['local', 's3', 'gcs', 'azure'], default: 'local' },
    fileUrl: String,
    checksum: String,
    notes: String,
    completedAt: Date,
  },
  { timestamps: true }
);

backupJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BackupJob', backupJobSchema);
