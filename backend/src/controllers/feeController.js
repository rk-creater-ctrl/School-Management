const Fee = require('../models/Fee');
const Student = require('../models/Student');

exports.getAllFees = async (req, res) => {
  try {
    const fees = await Fee.find()
      .populate('studentId', 'name rollNo')
      .populate('classId', 'name');
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createFee = async (req, res) => {
  try {
    const fee = new Fee(req.body);
    const savedFee = await fee.save();
    res.status(201).json(savedFee);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateFeeStatus = async (req, res) => {
  try {
    const { paidAmount } = req.body;
    const fee = await Fee.findByIdAndUpdate(
      req.params.id,
      { 
        paidAmount,
        paidDate: new Date(),
        status: paidAmount > 0 ? 'paid' : 'pending'
      },
      { new: true }
    ).populate('studentId', 'name rollNo');
    
    res.json(fee);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getStudentFees = async (req, res) => {
  try {
    const fees = await Fee.find({ studentId: req.params.studentId })
      .populate('classId', 'name')
      .sort({ dueDate: -1 });
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOverdueFees = async (req, res) => {
  try {
    const overdue = await Fee.find({
      status: 'pending',
      dueDate: { $lt: new Date() }
    }).populate('studentId', 'name rollNo');
    res.json(overdue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};