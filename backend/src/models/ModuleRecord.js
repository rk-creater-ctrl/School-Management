const mongoose = require('mongoose');

const moduleRecordSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      enum: [
        'admissions',
        'staff',
        'payroll',
        'staffAttendance',
        'schoolSettings',
        'exams',
        'results',
        'timetable',
        'assignments',
        'lms',
        'communication',
        'transport',
        'library',
        'hostel',
        'inventory',
        'reports',
        'ai',
      ],
    },
    referenceNo: { type: String, required: true },
    title: { type: String, required: true },
    ownerName: String,
    groupName: String,
    status: { type: String, default: 'active' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    payload: mongoose.Schema.Types.Mixed,
    attachments: [
      {
        name: String,
        url: String,
        provider: { type: String, default: 'cloudinary' },
      },
    ],
    dueDate: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

moduleRecordSchema.index({ module: 1, status: 1 });
moduleRecordSchema.index({ referenceNo: 1, module: 1 }, { unique: true });

module.exports = mongoose.model('ModuleRecord', moduleRecordSchema);
