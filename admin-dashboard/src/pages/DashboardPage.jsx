import { createElement, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Bus,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileBadge,
  FileText,
  GraduationCap,
  History,
  Library,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  UserCheck,
} from "lucide-react";
import { erpAPI, studentsAPI } from "../api";
import { canUseRole, getStoredUser } from "../permissions";

const moduleDefinitions = [
  { name: "Admissions", key: "admissions", path: "/modules/admissions", icon: ClipboardList, action: "New Enquiry", roles: ["superadmin", "staff"] },
  { name: "Fees", key: "fees", path: "/fees", icon: CircleDollarSign, action: "Collect Fee", roles: ["superadmin", "accountant", "parent"] },
  { name: "Documents", key: "documents", path: "/documents", icon: FileBadge, action: "Generate", roles: ["superadmin", "teacher", "staff"] },
  { name: "Exams", key: "exams", path: "/modules/exams", icon: ShieldCheck, action: "Marks", roles: ["superadmin", "teacher", "student", "parent"] },
  { name: "Payroll", key: "staff", path: "/modules/staff", icon: Users, action: "Payroll", roles: ["superadmin", "accountant"] },
  { name: "Inventory", key: "inventory", path: "/modules/inventory", icon: Package, action: "Checkout", roles: ["superadmin", "staff"] },
  { name: "Transport", key: "transport", path: "/modules/transport", icon: Bus, action: "Routes", roles: ["superadmin", "parent", "staff"] },
  { name: "Library", key: "library", path: "/modules/library", icon: Library, action: "Issue", roles: ["superadmin", "librarian", "student"] },
];

const commandActions = [
  { label: "Attendance", path: "/attendance", icon: CalendarCheck, roles: ["superadmin", "admin", "teacher", "student", "parent"] },
  { label: "Staff Attendance", path: "/staff-attendance", icon: UserCheck, roles: ["superadmin", "admin"] },
  { label: "Homework", path: "/classes", icon: FileText, roles: ["superadmin", "admin", "teacher"] },
  { label: "Notice", path: "/notices", icon: Bell, roles: ["superadmin", "admin", "teacher", "staff"] },
  { label: "Student Accounts", path: "/users", icon: Users, roles: ["superadmin", "admin"] },
  { label: "Admission Enquiry", path: "/modules/admissions", icon: ClipboardList, roles: ["superadmin", "staff"] },
  { label: "Fee Collection", path: "/fees", icon: CircleDollarSign, roles: ["superadmin", "accountant", "parent"] },
  { label: "Collections", path: "/fees/collections", icon: ReceiptText, roles: ["superadmin", "accountant"] },
  { label: "Marksheet", path: "/documents", icon: FileText, roles: ["superadmin", "teacher", "staff"] },
  { label: "ID Card", path: "/documents", icon: FileBadge, roles: ["superadmin", "teacher", "staff"] },
  { label: "Inventory Due", path: "/modules/inventory", icon: Package, roles: ["superadmin", "staff"] },
  { label: "Notifications", path: "/notifications", icon: Bell, roles: ["superadmin", "admin", "teacher", "student", "parent", "accountant", "librarian", "staff"] },
  { label: "School Settings", path: "/school-settings", icon: Settings, roles: ["superadmin"] },
  { label: "Audit Log", path: "/audit-log", icon: History, roles: ["superadmin"] },
];

const dueControls = [
  { label: "Bus Due", path: "/modules/inventory", icon: Bus, roles: ["superadmin", "staff"] },
  { label: "Lab Due", path: "/modules/inventory", icon: ShieldCheck, roles: ["superadmin", "staff"] },
  { label: "Fees Due", path: "/fees", icon: CircleDollarSign, roles: ["superadmin", "accountant"] },
  { label: "ID Card Due", path: "/documents", icon: FileBadge, roles: ["superadmin", "staff"] },
  { label: "TC Due", path: "/modules/admissions", icon: FileText, roles: ["superadmin", "staff"] },
];

function DashboardPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const currentRole = currentUser?.role;
  const [analytics, setAnalytics] = useState(null);
  const [studentsCount, setStudentsCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [dataStatus, setDataStatus] = useState("Syncing...");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [studentRes, analyticsRes] = await Promise.all([
          studentsAPI.getAll().catch(() => ({ data: [] })),
          erpAPI.analytics(),
        ]);
        const students = studentRes.data || [];
        setAnalytics(analyticsRes.data);
        setStudentsCount(analyticsRes.data?.totals?.students ?? students.length);
        setClassesCount(new Set(students.map((student) => student.className).filter(Boolean)).size);
        setDataStatus("");
      } catch {
        setDataStatus("Offline mode");
      }
    }

    loadDashboardData();
  }, []);

  const attendanceSeries = analytics?.charts?.attendance?.map((item) => item.value) || [];
  const revenueSeries = analytics?.charts?.revenue?.map((item) => item.value) || [];
  const revenueTotal = analytics?.totals?.paidAmount || 0;
  const campusHealth = attendanceSeries.length
    ? Math.round(attendanceSeries.reduce((sum, value) => sum + value, 0) / attendanceSeries.length)
    : 0;
  const moduleCounts = analytics?.modules || [];
  const activities = analytics?.activities || [];

  const modules = moduleDefinitions.filter((module) => canUseRole(module.roles, currentUser)).map((module) => {
    const stats = moduleCounts.find((item) => item.module === module.key);
    return {
      ...module,
      count: stats?.count || 0,
      pending: stats?.pending || 0,
    };
  });

  const statCards = [
    { label: "Students", value: studentsCount.toLocaleString(), delta: "Active", icon: GraduationCap, tone: "blue" },
    { label: "Classes", value: classesCount.toLocaleString(), delta: "Running", icon: Users, tone: "green" },
    { label: "Attendance", value: `${campusHealth}%`, delta: "Average", icon: CheckCircle2, tone: "amber" },
    ...(canUseRole(["superadmin", "accountant", "parent"], { role: currentRole })
      ? [{ label: "Fees", value: formatCurrency(revenueTotal), delta: `${analytics?.totals?.feePlans || 0} plans`, icon: CircleDollarSign, tone: "rose" }]
      : []),
  ];
  const visibleCommands = commandActions.filter((item) => canUseRole(item.roles, currentUser));
  const visibleDueControls = dueControls.filter((item) => canUseRole(item.roles, currentUser));

  function exportAttendanceReport() {
    const labels = analytics?.charts?.attendance?.map((item) => item.label) || [];
    const rows = [["Month", "Attendance %"], ...attendanceSeries.map((value, index) => [labels[index] || `M${index + 1}`, value])];
    downloadCsv("attendance-analytics.csv", rows);
  }

  return (
    <div className="dashboard-grid pro-dashboard">
      <section className="dashboard-command">
        <div className="command-title">
          <span className="eyebrow">Dashboard</span>
          <h2>School Control Panel</h2>
        </div>
        <div className="command-actions">
          {visibleCommands.map((item) => (
            <button className="command-button" key={item.label} type="button" onClick={() => navigate(item.path)}>
              {createElement(item.icon, { size: 18 })}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {dataStatus && <div className="inline-alert dashboard-alert">{dataStatus}</div>}

      <section className="stats-grid">
        {statCards.map((card) => (
          <article className={`metric-card tone-${card.tone}`} key={card.label}>
            <div className="metric-icon">{createElement(card.icon, { size: 20 })}</div>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small><TrendingUp size={14} /> {card.delta}</small>
          </article>
        ))}
      </section>

      <section className="module-board wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Operations</span>
            <h3>Module Actions</h3>
          </div>
        </div>
        <div className="operation-grid">
          {modules.map((module) => (
            <button className="operation-card" key={module.name} type="button" onClick={() => navigate(module.path)}>
              <span className="operation-icon">{createElement(module.icon, { size: 20 })}</span>
              <span className="operation-main">
                <strong>{module.name}</strong>
                <small>{module.action}</small>
              </span>
              <span className="operation-meta">
                <b>{module.count}</b>
                <small>{module.pending} pending</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      </section>

      <section className="chart-card wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Attendance</span>
            <h3>Monthly Trend</h3>
          </div>
          <button className="ghost-button" onClick={exportAttendanceReport}>Export CSV</button>
        </div>
        {attendanceSeries.some(Boolean) ? <LineChart data={attendanceSeries} color="#22c55e" suffix="%" /> : <EmptyState text="No attendance records." />}
      </section>

      {canUseRole(["superadmin", "accountant", "parent"], currentUser) && (
        <section className="chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Fees</span>
              <h3>Collection</h3>
            </div>
          </div>
          {revenueSeries.some(Boolean) ? <BarChart data={revenueSeries} /> : <EmptyState text="No fee records." />}
        </section>
      )}

      <section className="chart-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Due Desk</span>
            <h3>Controls</h3>
          </div>
        </div>
        <div className="due-grid">
          {visibleDueControls.map((item) => (
            <button className="due-option" key={item.label} type="button" onClick={() => navigate(item.path)}>
              {createElement(item.icon, { size: 18 })}
              <span>{item.label}</span>
            </button>
          ))}
          {visibleDueControls.length === 0 && <div className="empty-state">No due controls for this role.</div>}
        </div>
      </section>

      <section className="activity-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Activity</span>
            <h3>Recent</h3>
          </div>
        </div>
        {activities.map((activity) => (
          <div className="activity-item" key={activity._id || activity.action}>
            <span />
            <p>{activity.action ? `${activity.action} in ${activity.module}` : activity.title || "Activity recorded"}</p>
          </div>
        ))}
        {activities.length === 0 && <EmptyState text="No activity." />}
      </section>
    </div>
  );
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function LineChart({ data, color, suffix }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / (max - min || 1)) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="svg-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
        <polyline fill="none" stroke={color} strokeWidth="3" points={points} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-legend">
        {data.map((value, index) => <span key={index}>{value}{suffix}</span>)}
      </div>
    </div>
  );
}

function BarChart({ data }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  return (
    <div className="bar-chart">
      {data.map((value, index) => (
        <span key={index} style={{ height: `${(value / max) * 100}%` }} title={`Rs. ${value}k`} />
      ))}
    </div>
  );
}

export default DashboardPage;
