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
router.get('/password-change-requests', auth, authorize('users.approve'), listPasswordChangeRequests);
router.patch('/password-change-requests/:id', auth, authorize('users.approve'), reviewPasswordChangeRequest);
router.get('/users', auth, authorize('users.view'), listUsers);
router.post('/users', auth, authorize('users.create'), createUser);
router.put('/users/:id', auth, authorize('users.edit', 'users.manage'), updateUser);
router.delete('/users/:id', auth, authorize('users.delete', 'users.manage'), deleteUser);

module.exports = router;
