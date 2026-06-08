const express = require('express');
const {
  register,
  login,
  me,
  updateMe,
  forgotPassword,
  verifyOtp,
  confirmPassword,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  createPasswordChangeRequest,
  listPasswordChangeRequests,
  reviewPasswordChangeRequest,
} = require('../controllers/authController');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);
router.patch('/me', auth, updateMe);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/confirm-password', auth, confirmPassword);
router.post('/password-change-requests', auth, createPasswordChangeRequest);
router.get('/password-change-requests', auth, authorize('superadmin', 'admin'), listPasswordChangeRequests);
router.patch('/password-change-requests/:id', auth, authorize('superadmin', 'admin'), reviewPasswordChangeRequest);
router.get('/users', auth, authorize('superadmin', 'admin'), listUsers);
router.post('/users', auth, authorize('superadmin', 'admin'), createUser);
router.put('/users/:id', auth, authorize('superadmin'), updateUser);
router.delete('/users/:id', auth, authorize('superadmin'), deleteUser);

module.exports = router;
