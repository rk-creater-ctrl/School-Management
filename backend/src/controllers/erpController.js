const ActivityLog = require('../models/ActivityLog');
const ModuleRecord = require('../models/ModuleRecord');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const { writeActivity } = require('../utils/audit');
const { filterStudentsForUser, getRole, hasAnyRole, hasPermission } = require('../utils/accessScope');

const modulePermissions = {
  admissions: { view: 'admissions.view', manage: 'admissions.manage' },
  staff: { view: 'staff.view', manage: 'staff.manage' },
  payroll: { view: 'staff.view', manage: 'staff.manage' },
  staffAttendance: { view: 'staff_attendance.view', manage: 'staff_attendance.manage' },
  exams: { view: 'exams.view', manage: 'exams.manage' },
  results: { view: 'reports.view', manage: 'reports.manage' },
  timetable: { view: 'classes.view', manage: 'classes.manage' },
  assignments: { view: 'classes.view', manage: 'classes.manage' },
  lms: { view: 'lms.view', manage: 'lms.manage' },
  communication: { view: 'notices.view', manage: 'notices.manage' },
  transport: { view: 'transport.view', manage: 'transport.manage' },
  library: { view: 'library.view', manage: 'library.manage' },
  hostel: { view: 'admissions.view', manage: 'admissions.manage' },
  inventory: { view: 'inventory.view', manage: 'inventory.manage' },
  reports: { view: 'reports.view', manage: 'reports.manage' },
  ai: { view: 'teachers.view', manage: 'teachers.manage' },
  schoolSettings: { view: 'settings.view', manage: 'settings.manage' },
};

function canAccess(user, module) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const config = modulePermissions[module];
  return config ? hasPermission(user, config.view) || hasPermission(user, config.manage) : false;
}

function canWrite(user, module) {
  if (!user) return false;
  const config = modulePermissions[module];
  return config ? hasPermission(user, config.manage) : false;
}

function scopedQuery(user, extra = {}) {
  return extra;
}

function isFamilyRole(user) {
  return ['parent', 'student'].includes(getRole(user));
}

function getRecordStudentId(record) {
  return String(record?.student?._id || record?.student || record?.studentId || '');
}

function getRecordAdmissionNo(record) {
  return String(record?.admissionNo || record?.studentAdmissionNo || '').trim().toLowerCase();
}

function filterRecordsByStudents(records, visibleStudentIds, visibleAdmissionNos) {
  return records.filter((record) => {
    const studentId = getRecordStudentId(record);
    const admissionNo = getRecordAdmissionNo(record);
    return visibleStudentIds.has(studentId) || (admissionNo && visibleAdmissionNos.has(admissionNo));
  });
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
    const familyRole = isFamilyRole(req.user);
    const [allStudents, teachers, allFees, allAttendance, activities, notifications, moduleCounts] = await Promise.all([
      Student.find(scopedQuery(req.user)).lean(),
      User.countDocuments(scopedQuery(req.user, { role: 'teacher' })),
      Fee.find(scopedQuery(req.user)).select('student admissionNo totalFee paidAmount dueAmount createdAt').lean(),
      Attendance.find(scopedQuery(req.user)).select('student studentId admissionNo date status').lean(),
      ActivityLog.find(scopedQuery(req.user)).sort({ createdAt: -1 }).limit(10).lean(),
      Notification.find(scopedQuery(req.user)).sort({ createdAt: -1 }).limit(10).lean(),
      ModuleRecord.aggregate([
        { $match: scopedQuery(req.user) },
        { $group: { _id: '$module', count: { $sum: 1 }, pending: { $sum: { $cond: [{ $regexMatch: { input: '$status', regex: /pending/i } }, 1, 0] } } } },
      ]),
    ]);
    const visibleStudents = filterStudentsForUser(allStudents, req.user);
    const visibleStudentIds = new Set(visibleStudents.map((student) => String(student._id || student.id)));
    const visibleAdmissionNos = new Set(visibleStudents.map((student) => String(student.admissionNo || '').trim().toLowerCase()).filter(Boolean));
    const fees = familyRole ? filterRecordsByStudents(allFees, visibleStudentIds, visibleAdmissionNos) : allFees;
    const attendance = familyRole ? filterRecordsByStudents(allAttendance, visibleStudentIds, visibleAdmissionNos) : allAttendance;
    const safeActivities = familyRole ? [] : activities;
    const safeNotifications = familyRole ? [] : notifications;
    const safeModuleCounts = familyRole ? [] : moduleCounts;
    const teacherCount = familyRole ? 0 : teachers;

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
        students: visibleStudents.length,
        teachers: teacherCount,
        feePlans: fees.length,
        attendanceRecords: attendance.length,
        classes: 0,
        ...feeTotals,
      },
      charts: {
        attendance: attendanceByMonth,
        revenue: revenueByMonth,
      },
      activities: safeActivities,
      notifications: safeNotifications,
      modules: addTeacherCountToModules(safeModuleCounts, teacherCount),
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
