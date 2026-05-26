const ActivityLog = require('../models/ActivityLog');
const ModuleRecord = require('../models/ModuleRecord');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const { writeActivity } = require('../utils/audit');

const modulePermissions = {
  admissions: ['staff'],
  staff: ['accountant'],
  payroll: ['accountant'],
  staffAttendance: ['admin'],
  exams: ['teacher'],
  results: ['teacher'],
  timetable: ['teacher'],
  assignments: ['admin', 'teacher', 'student'],
  lms: ['teacher', 'student'],
  communication: ['admin', 'teacher', 'staff'],
  transport: ['staff'],
  library: ['librarian'],
  hostel: ['staff'],
  inventory: ['staff'],
  reports: ['accountant', 'teacher'],
  ai: ['teacher'],
};

function canAccess(user, module) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  return (modulePermissions[module] || []).includes(user.role);
}

function canWrite(user, module) {
  if (!user) return false;
  if (module === 'staffAttendance') return user.role === 'superadmin';
  return canAccess(user, module);
}

function scopedQuery(user, extra = {}) {
  return extra;
}

function monthLabels() {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}

function titleCase(value) {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Active';
}

function summarizeTeacherWork(profile) {
  const assignments = profile?.assignments || [];
  if (assignments.length) {
    return assignments
      .slice(0, 3)
      .map((item) => [item.className, item.subject].filter(Boolean).join(' - '))
      .join(', ');
  }

  const subjects = profile?.subjects || [];
  return subjects.length ? subjects.join(', ') : 'Teaching';
}

async function getTeacherStaffRecords() {
  const teachers = await User.find({ role: 'teacher' })
    .select('name username email phone status createdAt updatedAt')
    .sort({ name: 1 })
    .lean();

  if (!teachers.length) return [];

  const profiles = await TeacherProfile.find({ userId: { $in: teachers.map((teacher) => teacher._id) } }).lean();
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));

  return teachers.map((teacher) => {
    const profile = profileByUserId.get(String(teacher._id));
    return {
      referenceNo: profile?.employeeCode || `TCHR-${String(teacher._id).slice(-6).toUpperCase()}`,
      title: teacher.name || 'Teacher',
      ownerName: teacher.name || 'Teacher',
      groupName: profile?.department || 'Teaching Staff',
      status: titleCase(teacher.status),
      priority: 'medium',
      payload: {
        source: 'teacher-account',
        action: 'Teacher login account',
        payrollCategory: 'Skilled',
        designation: profile?.designation || 'Teacher',
        subject: summarizeTeacherWork(profile),
        phone: profile?.alternatePhone || teacher.phone || '',
        email: teacher.email || '',
        username: teacher.username || '',
      },
      readOnly: true,
      sourceId: teacher._id,
      createdAt: teacher.createdAt,
      updatedAt: profile?.updatedAt || teacher.updatedAt,
    };
  });
}

function addTeacherCountToModules(moduleCounts, teacherCount) {
  const modules = moduleCounts.map((item) => ({
    module: item._id,
    count: item.count,
    pending: item.pending,
  }));

  if (!teacherCount) return modules;

  const staffModule = modules.find((item) => item.module === 'staff');
  if (staffModule) {
    staffModule.count += teacherCount;
  } else {
    modules.push({ module: 'staff', count: teacherCount, pending: 0 });
  }

  return modules;
}

exports.analytics = async (req, res) => {
  try {
    const [students, teachers, feePlans, attendanceRecords, fees, attendance, activities, notifications, moduleCounts] = await Promise.all([
      Student.countDocuments(scopedQuery(req.user)),
      User.countDocuments(scopedQuery(req.user, { role: 'teacher' })),
      Fee.countDocuments(scopedQuery(req.user)),
      Attendance.countDocuments(scopedQuery(req.user)),
      Fee.find(scopedQuery(req.user)).select('totalFee paidAmount dueAmount createdAt').lean(),
      Attendance.find(scopedQuery(req.user)).select('date status').lean(),
      ActivityLog.find(scopedQuery(req.user)).sort({ createdAt: -1 }).limit(10).lean(),
      Notification.find(scopedQuery(req.user)).sort({ createdAt: -1 }).limit(10).lean(),
      ModuleRecord.aggregate([
        { $match: scopedQuery(req.user) },
        { $group: { _id: '$module', count: { $sum: 1 }, pending: { $sum: { $cond: [{ $regexMatch: { input: '$status', regex: /pending/i } }, 1, 0] } } } },
      ]),
    ]);

    const feeTotals = fees.reduce(
      (totals, fee) => ({
        totalFee: totals.totalFee + (fee.totalFee || 0),
        paidAmount: totals.paidAmount + (fee.paidAmount || 0),
        dueAmount: totals.dueAmount + (fee.dueAmount || 0),
      }),
      { totalFee: 0, paidAmount: 0, dueAmount: 0 }
    );

    const attendanceByMonth = monthLabels().map((label, monthIndex) => {
      const rows = attendance.filter((item) => new Date(item.date).getMonth() === monthIndex && item.status !== 'Holiday');
      const present = rows.filter((item) => ['Present', 'HalfDay'].includes(item.status)).length;
      return {
        label,
        value: rows.length ? Math.round((present / rows.length) * 100) : 0,
      };
    });

    const revenueByMonth = monthLabels().map((label, monthIndex) => {
      const value = fees
        .filter((fee) => new Date(fee.createdAt).getMonth() === monthIndex)
        .reduce((sum, fee) => sum + (fee.paidAmount || 0), 0);
      return { label, value };
    });

    res.json({
      totals: {
        students,
        teachers,
        feePlans,
        attendanceRecords,
        classes: 0,
        ...feeTotals,
      },
      charts: {
        attendance: attendanceByMonth,
        revenue: revenueByMonth,
      },
      activities,
      notifications,
      modules: addTeacherCountToModules(moduleCounts, teachers),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.auditLogs = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can view audit logs' });
    }

    const query = {};
    if (req.query.module) query.module = req.query.module;
    if (req.query.action) query.action = req.query.action;
    if (req.query.actorRole) query.actorRole = req.query.actorRole;
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
    }

    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const logs = await ActivityLog.find(query)
      .populate('actor', 'name username email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.listRecords = async (req, res) => {
  try {
    const { module } = req.params;
    if (!canAccess(req.user, module)) return res.status(403).json({ error: 'Access denied' });
    if (!canWrite(req.user, module)) return res.status(403).json({ error: 'Only superadmin can edit this module' });

    const query = {
      module,
      ...(req.query.status ? { status: req.query.status } : {}),
    };

    const records = await ModuleRecord.find(query).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 100).lean();
    if (module === 'staff') {
      const teacherRecords = await getTeacherStaffRecords();
      return res.json([...teacherRecords, ...records]);
    }

    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const { module } = req.params;
    if (!canAccess(req.user, module)) return res.status(403).json({ error: 'Access denied' });

    const record = await ModuleRecord.create({
      ...req.body,
      module,
      referenceNo: req.body.referenceNo || `${module.toUpperCase()}-${Date.now()}`,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await writeActivity(req, 'create', module, record._id.toString(), { title: record.title });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const { module, id } = req.params;
    if (!canAccess(req.user, module)) return res.status(403).json({ error: 'Access denied' });
    if (!canWrite(req.user, module)) return res.status(403).json({ error: 'Only superadmin can edit this module' });

    const record = await ModuleRecord.findOneAndUpdate(
      { _id: id, module },
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ error: 'Record not found' });

    await writeActivity(req, 'update', module, record._id.toString(), { title: record.title });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const { module, id } = req.params;
    if (!canAccess(req.user, module)) return res.status(403).json({ error: 'Access denied' });
    if (!canWrite(req.user, module)) return res.status(403).json({ error: 'Only superadmin can edit this module' });

    const record = await ModuleRecord.findOneAndDelete({
      _id: id,
      module,
    });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    await writeActivity(req, 'delete', module, id, { title: record.title });
    res.json({ message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
