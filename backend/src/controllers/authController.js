const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function signToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET || 'development-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(user) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    studentId: user.studentId,
    linkedStudentId: user.linkedStudentId,
    studentAdmissionNo: user.studentAdmissionNo,
    linkedStudentAdmissionNo: user.linkedStudentAdmissionNo,
    isEmailVerified: user.isEmailVerified,
  };
}

exports.register = async (req, res) => {
  try {
    const { name, username, email, password, phone } = req.body;
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.status(403).json({ error: 'Accounts must be created by superadmin or admin' });
    }
    
    const existingUser = await User.findOne({
      $or: [
        { email: String(email || "").toLowerCase().trim() },
        ...(username ? [{ username: String(username).toLowerCase().trim() }] : []),
      ],
    });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const user = new User({ name, username, email, password, role: 'superadmin', phone });
    await user.save();

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginId = String(identifier || username || email || "").toLowerCase().trim();
    
    const user = await User.findOne({
      $or: [{ email: loginId }, { username: loginId }],
    }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.me = async (req, res) => {
  res.json({ user: publicUser(req.user) });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'If the account exists, an OTP has been sent.' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.otpHash = await bcrypt.hash(otp, 10);
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    res.json({
      message: 'OTP generated. Connect email or SMS provider to deliver it.',
      devOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.otpHash || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const isValid = await bcrypt.compare(otp, user.otpHash);
    if (!isValid) return res.status(400).json({ error: 'Invalid or expired OTP' });

    user.isEmailVerified = true;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.confirmPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { role: { $in: ['student', 'teacher'] } } : {};
    const users = await User.find(filter).select('-password -otpHash').sort({ role: 1, name: 1 }).lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const requestedRole = req.body.role;
    const {
      name,
      username,
      email,
      password,
      phone,
      studentId,
      linkedStudentId,
      studentAdmissionNo,
      linkedStudentAdmissionNo,
    } = req.body;
    const role = requestedRole || 'student';

    if (req.user.role === 'admin' && !['student', 'teacher'].includes(role)) {
      return res.status(403).json({ error: 'Admin can create student and teacher accounts only' });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: String(email || "").toLowerCase().trim() },
        ...(username ? [{ username: String(username).toLowerCase().trim() }] : []),
      ],
    });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const user = new User({
      name,
      username,
      email,
      password,
      phone,
      role,
      studentId,
      linkedStudentId,
      studentAdmissionNo,
      linkedStudentAdmissionNo,
    });
    await user.save();
    res.status(201).json(publicUser(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { password, updates = {} } = req.body;
    if (!password) return res.status(400).json({ error: 'Superadmin password is required' });

    const superadmin = await User.findById(req.user._id).select('+password');
    if (!superadmin || superadmin.role !== 'superadmin' || !(await superadmin.comparePassword(password))) {
      return res.status(403).json({ error: 'Invalid superadmin password' });
    }

    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const allowed = [
      'name',
      'username',
      'email',
      'phone',
      'role',
      'status',
      'studentId',
      'linkedStudentId',
      'studentAdmissionNo',
      'linkedStudentAdmissionNo',
    ];
    for (const key of allowed) {
      if (updates[key] !== undefined) user[key] = updates[key];
    }

    if (updates.password) {
      user.password = updates.password;
    }

    if (updates.email || updates.username) {
      const duplicateQuery = {
        _id: { $ne: user._id },
        $or: [
          ...(updates.email ? [{ email: String(updates.email).toLowerCase().trim() }] : []),
          ...(updates.username ? [{ username: String(updates.username).toLowerCase().trim() }] : []),
        ],
      };
      if (duplicateQuery.$or.length) {
        const existing = await User.findOne(duplicateQuery);
        if (existing) return res.status(400).json({ error: 'Username or email already exists' });
      }
    }

    await user.save();
    res.json(publicUser(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Superadmin password is required' });

    const superadmin = await User.findById(req.user._id).select('+password');
    if (!superadmin || superadmin.role !== 'superadmin' || !(await superadmin.comparePassword(password))) {
      return res.status(403).json({ error: 'Invalid superadmin password' });
    }

    if (String(superadmin._id) === String(req.params.id)) {
      return res.status(400).json({ error: 'You cannot delete your own superadmin account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
