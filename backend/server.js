const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config();

const { getSupabase } = require("./src/lib/supabaseModel");

const feesRoutes = require("./src/routes/fees");
const attendanceRoutes = require("./src/routes/attendance");
const classesRoutes = require("./src/routes/classes");
const homeworkRoutes = require("./src/routes/homework");
const classNoticesRoutes = require("./src/routes/classNotices");
const teacherRoutes = require("./src/routes/teachers");
const staffPayrollRoutes = require("./src/routes/staffPayroll");
const staffDirectoryRoutes = require("./src/routes/staffDirectory");
const transportRoutes = require("./src/routes/transport");
const academicYearRoutes = require("./src/routes/academicYears");
const authRoutes = require("./src/routes/auth");
const studentsRoutes = require("./src/routes/students");
const erpRoutes = require("./src/routes/erp");
const systemRoutes = require("./src/routes/system");
const schoolsRoutes = require("./src/routes/schools");
const uploadRoutes = require("./src/routes/uploads");
const websiteLeadsRoutes = require("./src/routes/websiteLeads");

const app = express();

app.use(helmet());

const defaultCorsOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || defaultCorsOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/erp", erpRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/schools", schoolsRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/website-leads", websiteLeadsRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/classes", classesRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/class-notices", classNoticesRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/staff-payroll", staffPayrollRoutes);
app.use("/api/staff-directory", staffDirectoryRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/academic-years", academicYearRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

app.get("/", (req, res) => {
  res.json({
    message: "School Management Backend Running!",
    version: "1.0.0",
    docs: "/health",
  });
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;

function formatStartupError(err) {
  const parts = [err.message, err.code, err.details, err.hint].filter(Boolean);
  if (parts.length) return parts.join(" | ");

  try {
    const plain = JSON.stringify(err);
    return plain && plain !== "{}" ? plain : String(err);
  } catch {
    return String(err);
  }
}

async function startServer() {
  try {
    const tableName = process.env.SUPABASE_RECORDS_TABLE || "school_records";
    const { error } = await getSupabase()
      .from(tableName)
      .select("id", { head: true, count: "exact" });

    if (error) throw error;
    console.log(`Supabase connected (${tableName})`);
  } catch (err) {
    console.error("Supabase connection error:", formatStartupError(err));
    console.error("Check backend/.env.local, the service role key, and backend/supabase-schema.sql.");
    process.exitCode = 1;
    return;
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
  });
}

startServer();
