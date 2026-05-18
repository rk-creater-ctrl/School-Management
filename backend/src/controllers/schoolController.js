const School = require('../models/School');
const { writeActivity } = require('../utils/audit');

exports.listSchools = async (req, res) => {
  try {
    const school = await School.findOne().sort({ createdAt: 1 });
    res.json(school ? [school] : []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createSchool = async (req, res) => {
  try {
    const code =
      req.body.code ||
      req.body.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24);

    const school = await School.findOneAndUpdate(
      {},
      {
        name: req.body.name,
        code: code || 'SCHOOL',
        academicYear: req.body.academicYear || '2026-27',
        contactEmail: req.body.contactEmail,
        contactPhone: req.body.contactPhone,
        address: req.body.address,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await writeActivity(req, 'update', 'school', school._id.toString(), { name: school.name });
    res.status(200).json(school);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
