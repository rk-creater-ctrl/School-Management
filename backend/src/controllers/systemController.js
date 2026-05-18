const BackupJob = require('../models/BackupJob');
const { writeActivity } = require('../utils/audit');

exports.listBackups = async (req, res) => {
  try {
    const backups = await BackupJob.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.requestBackup = async (req, res) => {
  try {
    const backup = await BackupJob.create({
      requestedBy: req.user._id,
      type: req.body.type || 'full',
      storageProvider: req.body.storageProvider || 'local',
      notes: req.body.notes,
    });

    await writeActivity(req, 'request_backup', 'system', backup._id.toString(), {
      type: backup.type,
      storageProvider: backup.storageProvider,
    });

    res.status(202).json({
      message: 'Backup job queued. Attach a worker process to perform database/file export.',
      backup,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markBackupComplete = async (req, res) => {
  try {
    const backup = await BackupJob.findOneAndUpdate(
      { _id: req.params.id },
      {
        status: 'completed',
        fileUrl: req.body.fileUrl,
        checksum: req.body.checksum,
        completedAt: new Date(),
      },
      { new: true }
    );

    if (!backup) return res.status(404).json({ error: 'Backup job not found' });
    await writeActivity(req, 'complete_backup', 'system', backup._id.toString());

    res.json(backup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
