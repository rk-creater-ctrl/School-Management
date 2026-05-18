const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 6 },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'teacher', 'student', 'parent', 'accountant', 'librarian', 'staff'],
    default: 'teacher'
  },
  phone: { type: String },
  isEmailVerified: { type: Boolean, default: false },
  otpHash: { type: String },
  otpExpiresAt: { type: Date },
  lastLoginAt: { type: Date },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (this.email) this.email = this.email.toLowerCase().trim();
  if (this.username) this.username = this.username.toLowerCase().trim();
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
