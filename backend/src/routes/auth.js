const express = require('express');
const {
  register,
  login,
  me,
  forgotPassword,
  verifyOtp,
  confirmPassword,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/authController');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/confirm-password', auth, confirmPassword);
router.get('/users', auth, authorize('superadmin', 'admin'), listUsers);
router.post('/users', auth, authorize('superadmin', 'admin'), createUser);
router.put('/users/:id', auth, authorize('superadmin'), updateUser);
router.delete('/users/:id', auth, authorize('superadmin'), deleteUser);

module.exports = router;
