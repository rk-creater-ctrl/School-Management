

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();
const feesRoutes = require("./src/routes/fees");
const attendanceRoutes = require("./src/routes/attendance");
const classesRoutes = require("./src/routes/classes");
const homeworkRoutes = require("./src/routes/homework");
const classNoticesRoutes = require("./src/routes/classNotices");
const authRoutes = require("./src/routes/auth");
const studentsRoutes = require("./src/routes/students");
const erpRoutes = require("./src/routes/erp");
const systemRoutes = require("./src/routes/system");
const schoolsRoutes = require("./src/routes/schools");
const uploadRoutes = require("./src/routes/uploads");


// ---------------------
// Middleware
// ---------------------
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/auth', authRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/students', studentsRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/classes", classesRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/class-notices", classNoticesRoutes);

// ---------------------
// Health + Root routes
// ---------------------
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Root endpoint MUST be before 404 handler
app.get('/', (req, res) => {
  res.json({
    message: 'School Management Backend Running!',
    version: '1.0.0',
    docs: '/health',
  });
});

// ---------------------
// MongoDB connection
// ---------------------
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server');
  mongoose.connection.close(() => process.exit(0));
});

// ---------------------
// 404 handler (keep last before error handler)
// ---------------------
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------------------
// Global error handler
// ---------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ---------------------
// Start server
// ---------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
