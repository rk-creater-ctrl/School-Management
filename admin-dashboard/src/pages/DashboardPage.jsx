import { createElement, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Bus,
  CheckCircle2,
  CircleDollarSign,
  GraduationCap,
  Globe2,
  Package,
  ReceiptText,
  TrendingUp,
  Users,
} from "lucide-react";
import { erpAPI, studentsAPI } from "../api";
import { canUseRole, getStoredUser } from "../permissions";

const commandActions = [
  { label: "Staff", path: "/staff", icon: Users, roles: ["superadmin", "admin", "accountant"] },
  { label: "Student", path: "/students", icon: GraduationCap, roles: ["superadmin", "admin", "teacher"] },
  { label: "Website Leads", path: "/website-leads", icon: Globe2, roles: ["superadmin", "admin", "staff"] },
  { label: "Collections", path: "/fees/collections", icon: ReceiptText, roles: ["superadmin", "accountant"] },
  { label: "Transport", path: "/modules/transport", icon: Bus, roles: ["superadmin", "admin", "accountant", "staff"] },
  { label: "Inventory", path: "/modules/inventory", icon: Package, roles: ["superadmin", "staff"] },
  { label: "Notifications", path: "/notifications", icon: Bell, roles: ["superadmin", "admin", "teacher", "student", "parent", "accountant", "librarian", "staff"] },
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
  const activities = analytics?.activities || [];

  const statCards = [
    { label: "Students", value: studentsCount.toLocaleString(), delta: "Active", icon: GraduationCap, tone: "blue" },
    { label: "Classes", value: classesCount.toLocaleString(), delta: "Running", icon: Users, tone: "green" },
    { label: "Attendance", value: `${campusHealth}%`, delta: "Average", icon: CheckCircle2, tone: "amber" },
    ...(canUseRole(["superadmin", "accountant", "parent", "student"], { role: currentRole })
      ? [{ label: "Fees", value: formatCurrency(revenueTotal), delta: `${analytics?.totals?.feePlans || 0} plans`, icon: CircleDollarSign, tone: "rose" }]
      : []),
  ];
  const visibleCommands = commandActions.filter((item) => canUseRole(item.roles, currentUser));

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

      {canUseRole(["superadmin", "accountant", "parent", "student"], currentUser) && (
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
