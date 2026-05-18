const express = require('express');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const { listBackups, requestBackup, markBackupComplete } = require('../controllers/systemController');

const router = express.Router();

router.use(auth);
router.get('/backups', authorize('admin'), listBackups);
router.post('/backups', authorize('admin'), requestBackup);
router.patch('/backups/:id/complete', authorize('admin'), markBackupComplete);

module.exports = router;
