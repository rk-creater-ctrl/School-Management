const User = require('../models/User');
const PasswordChangeRequest = require('../models/PasswordChangeRequest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { hasAnyRole } = require('../utils/accessScope');
const { normalizePermissionMode, normalizePermissions } = require('../utils/permissionCatalog');

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
    permissions: normalizePermissions(user.permissions),
    permissionMode: normalizePermissionMode(user.permissionMode),
    profilePhotoUrl: user.profilePhotoUrl || "",
    campus: user.campus || "",
    academicYear: user.academicYear || "",
    isEmailVerified: user.isEmailVerified,
  };
}

function cleanString(value) {
  return String(value || '').trim();
}

function passwordRequestResponse(request, user, reviewer) {
  const plain = request?.toObject ? request.toObject() : { ...(request || {}) };
  delete plain.requestedPasswordHash;

  return {
    ...plain,
    user: user
      ? {
          _id: user._id,
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          profilePhotoUrl: user.profilePhotoUrl || "",
        }
      : null,
    reviewer: reviewer
      ? {
          _id: reviewer._id,
          id: reviewer._id,
          name: reviewer.name,
          role: reviewer.role,
        }
      : null,
  };
}

function canReviewPasswordRequest(actor, targetUser) {
  if (!actor || !targetUser) return false;
  if (String(actor._id || actor.id) === String(targetUser._id || targetUser.id)) return false;
  if (actor.role === 'superadmin') return true;
  if (!hasAnyRole(actor, ['admin'])) return false;
  if (targetUser.role === 'superadmin') return false;
  return !hasAnyRole(targetUser, ['admin']);
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

exports.updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const email = cleanString(req.body.email).toLowerCase();
    if (email && email !== user.email) {
      const existing = await User.findOne({ _id: { $ne: user._id }, email });
      if (existing) return res.status(400).json({ error: 'Email already exists' });
      user.email = email;
    }

    if (req.body.name !== undefined) user.name = cleanString(req.body.name) || user.name;
    if (req.body.phone !== undefined) user.phone = cleanString(req.body.phone).replace(/\D/g, '').slice(0, 10);
    if (req.body.campus !== undefined) user.campus = cleanString(req.body.campus);
    if (req.body.academicYear !== undefined) user.academicYear = cleanString(req.body.academicYear);
    if (req.body.profilePhotoUrl !== undefined) user.profilePhotoUrl = cleanString(req.body.profilePhotoUrl);

    await user.save();
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to update profile' });
  }
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
    const filter = req.user.role === 'superadmin' ? {} : { role: { $in: ['student', 'teacher'] } };
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
      permissions,
      permissionMode,
    } = req.body;
    const role = requestedRole || 'student';

    if (req.user.role !== 'superadmin' && !['student', 'teacher'].includes(role)) {
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
      permissions: req.user.role === 'superadmin' ? permissions : [],
      permissionMode: req.user.role === 'superadmin' ? permissionMode : 'role',
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
      'permissions',
      'permissionMode',
      'profilePhotoUrl',
      'campus',
      'academicYear',
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

exports.createPasswordChangeRequest = async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      return res.status(400).json({ error: 'Superadmin passwords are changed directly from user management.' });
    }

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const existingPending = await PasswordChangeRequest.findOne({ userId: user._id, status: 'pending' }).lean();
    if (existingPending) {
      return res.status(409).json({ error: 'A password change request is already pending approval' });
    }

    const requestedPasswordHash = await bcrypt.hash(newPassword, 12);
    const request = await PasswordChangeRequest.create({
      userId: user._id,
      requestedBy: user._id,
      requesterRole: user.role,
      requestedPasswordHash,
      approverRoles: hasAnyRole(user, ['admin']) ? ['superadmin'] : ['admin', 'superadmin'],
      status: 'pending',
      note: cleanString(req.body.note),
      requestedAt: new Date(),
    });

    res.status(201).json(passwordRequestResponse(request, user));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create password request' });
  }
};

exports.listPasswordChangeRequests = async (req, res) => {
  try {
    const requests = await PasswordChangeRequest.find({}).sort({ createdAt: -1 }).lean();
    const userIds = [...new Set(requests.map((item) => String(item.userId || '')).filter(Boolean))];
    const reviewerIds = [...new Set(requests.map((item) => String(item.reviewedBy || '')).filter(Boolean))];
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('-password -otpHash').lean()
      : [];
    const reviewers = reviewerIds.length
      ? await User.find({ _id: { $in: reviewerIds } }).select('-password -otpHash').lean()
      : [];
    const userById = new Map(users.map((user) => [String(user._id), user]));
    const reviewerById = new Map(reviewers.map((user) => [String(user._id), user]));

    const visible = requests
      .filter((request) => canReviewPasswordRequest(req.user, userById.get(String(request.userId))))
      .map((request) =>
        passwordRequestResponse(
          request,
          userById.get(String(request.userId)),
          reviewerById.get(String(request.reviewedBy))
        )
      )
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.createdAt || b.requestedAt || 0) - new Date(a.createdAt || a.requestedAt || 0);
      });

    res.json(visible);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load password requests' });
  }
};

exports.reviewPasswordChangeRequest = async (req, res) => {
  try {
    const nextStatus = cleanString(req.body.status).toLowerCase();
    if (!['approved', 'rejected'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const request = await PasswordChangeRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Password request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This password request has already been reviewed' });
    }

    const user = await User.findById(request.userId).select('+password');
    if (!user) return res.status(404).json({ error: 'Request user not found' });
    if (!canReviewPasswordRequest(req.user, user)) {
      return res.status(403).json({ error: 'You cannot review this password request' });
    }

    if (nextStatus === 'approved') {
      user.password = request.requestedPasswordHash;
      await user.save();
    }

    request.status = nextStatus;
    request.reviewNote = cleanString(req.body.reviewNote);
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    res.json(passwordRequestResponse(request, user, req.user));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to review password request' });
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
