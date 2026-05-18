const express = require('express');
const auth = require('../middleware/auth');
const {
  analytics,
  auditLogs,
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
} = require('../controllers/erpController');

const router = express.Router();

router.use(auth);
router.get('/analytics', analytics);
router.get('/audit-logs', auditLogs);
router.get('/:module', listRecords);
router.post('/:module', createRecord);
router.put('/:module/:id', updateRecord);
router.delete('/:module/:id', deleteRecord);

module.exports = router;
