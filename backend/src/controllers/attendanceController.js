const Attendance = require('../models/Attendance');
const Student = require('../models/Student');

exports.markBulkAttendance = async (req, res) => {
  try {
    const { classId, date, attendances } = req.body;
    
    // Delete existing attendance for this class/date
    await Attendance.deleteMany({ classId, date });
    
    // Create new attendance records
    const attendanceRecords = attendances.map(att => ({
      studentId: att.studentId,
      classId,
      date: new Date(date),
      status: att.status
    }));
    
    const saved = await Attendance.insertMany(attendanceRecords);
    res.json({ 
      message: `${saved.length} attendance records marked`,
      count: saved.length 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getClassAttendance = async (req, res) => {
  try {
    const { classId, from, to } = req.query;
    const attendance = await Attendance.find({
      classId,
      date: { 
        $gte: new Date(from), 
        $lte: new Date(to || new Date()) 
      }
    }).populate('studentId', 'name rollNo');
    
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStudentAttendance = async (req, res) => {
  try {
    const { studentId, from, to } = req.query;
    const attendance = await Attendance.find({
      studentId,
      date: { 
        $gte: new Date(from), 
        $lte: new Date(to || new Date()) 
      }
    }).populate('classId', 'name');
    
    // Calculate percentage
    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const percentage = totalDays ? (presentDays / totalDays * 100).toFixed(2) : 0;
    
    res.json({ 
      attendance, 
      summary: { totalDays, presentDays, percentage }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};