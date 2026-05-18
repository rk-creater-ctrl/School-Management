const express = require('express');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const { listSchools, createSchool } = require('../controllers/schoolController');

const router = express.Router();

router.use(auth);
router.get('/', authorize('admin'), listSchools);
router.post('/', authorize('admin'), createSchool);

module.exports = router;
