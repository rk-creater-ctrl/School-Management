const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    logoUrl: String,
    address: String,
    contactEmail: String,
    contactPhone: String,
    academicYear: { type: String, default: '2026-27' },
    locale: { type: String, default: 'en-IN' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    settings: {
      paymentProvider: { type: String, enum: ['razorpay', 'stripe', 'manual'], default: 'razorpay' },
      smsProvider: String,
      whatsappProvider: String,
      backupFrequency: { type: String, default: 'daily' },
      pwaEnabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('School', schoolSchema);
