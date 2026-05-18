const Class = require('../models/Class');
const Student = require('../models/Student');

exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find().populate('teacherId', 'name');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createClass = async (req, res) => {
  try {
    const classData = new Class(req.body);
    const savedClass = await classData.save();
    res.status(201).json(savedClass);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    ).populate('teacherId', 'name');
    res.json(updatedClass);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getClassStudents = async (req, res) => {
  try {
    const students = await Student.find({ classId: req.params.classId });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};