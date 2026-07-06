import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  BookOpenCheck,
  Bus,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileBadge,
  History,
  GraduationCap,
  Globe2,
  Home,
  Library,
  LogOut,
  Menu,
  Megaphone,
  ReceiptText,
  Package,
  ShieldCheck,
  Sparkles,
  Settings,
  Users,
  UserCog,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { authAPI, erpAPI } from "../api";
import { canUseRole } from "../permissions";
import { getCurrentAcademicYear } from "../utils/academicYear";
import { clearActiveSession, getSessionUser, updateActiveUser } from "../utils/session";

const fallbackUser = {
  name: "Admin User",
  role: "admin",
  campus: "School ERP",
  academicYear: getCurrentAcademicYear(),
};
const notificationPollMs = 15000;

function getStoredUser() {
  return { ...fallbackUser, ...getSessionUser({}) };
}

const navGroups = [
  {
    label: "Operations",
    items: [
      { to: "/", label: "Dashboard", icon: Home, roles: ["superadmin", "admin", "teacher", "student", "parent", "accountant", "librarian", "staff"] },
      { to: "/students", label: "Students", icon: GraduationCap, roles: ["students.view"] },
      { to: "/classes", label: "Classes", icon: BookOpen, roles: ["classes.view"] },
      { to: "/teacher", label: "Teacher Desk", icon: BookOpenCheck, roles: ["teachers.view"] },
      { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["attendance.view"] },
      { to: "/staff", label: "Staff", icon: Users, roles: ["staff.view"] },
      { to: "/staff-attendance", label: "Staff Attendance", icon: UserCheck, roles: ["staff_attendance.view"] },
      { to: "/modules/admissions", label: "Admissions", icon: ClipboardList, roles: ["admissions.view"] },
      { to: "/website-leads", label: "Website Leads", icon: Globe2, roles: ["website_leads.view"] },
      { to: "/documents", label: "Documents", icon: FileBadge, roles: ["documents.view"] },
      { to: "/notices", label: "Notices", icon: Megaphone, roles: ["notices.view"] },
      { to: "/notifications", label: "Notifications", icon: Bell, roles: ["notifications.view"] },
      { to: "/users", label: "Users", icon: UserCog, roles: ["users.view"] },
    ],
  },
  {
    label: "Finance & People",
    items: [
      { to: "/fees", label: "Fees", icon: CircleDollarSign, roles: ["fees.view"] },
      { to: "/fees/collections", label: "Collections", icon: ReceiptText, roles: ["fees.manage"] },
      { to: "/modules/staff", label: "Staff & Payroll", icon: Users, roles: ["staff.view"] },
      { to: "/modules/exams", label: "Exams & Results", icon: ShieldCheck, roles: ["exams.view"] },
      { to: "/modules/lms", label: "LMS", icon: Sparkles, roles: ["lms.view"] },
    ],
  },
  {
    label: "Campus",
    items: [
      { to: "/modules/transport", label: "Transport", icon: Bus, roles: ["transport.view"] },
      { to: "/modules/library", label: "Library", icon: Library, roles: ["library.view"] },
      { to: "/modules/inventory", label: "Inventory", icon: Package, roles: ["inventory.view"] },
    ],
  },
  {
    label: "Super Admin",
    items: [
      { to: "/school-settings", label: "School Settings", icon: Settings, roles: ["settings.manage"] },
      { to: "/audit-log", label: "Audit Log", icon: History, roles: ["reports.view"] },
    ],
  },
];

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;

    authAPI
      .me()
      .then((res) => {
        if (!active) return;
        const user = { ...fallbackUser, ...res.data.user };
        setCurrentUser(user);
        updateActiveUser(user);
      })
      .catch(() => {});

    async function loadNotifications() {
      try {
        const res = await erpAPI.analytics();
        if (active) setNotifications(res.data.notifications || []);
      } catch {
        if (active) setNotifications([]);
      }
    }

    loadNotifications();
    const timer = window.setInterval(loadNotifications, notificationPollMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const visibleGroups = useMemo(
    () =>
      navGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => canUseRole(item.roles, currentUser)),
      })),
    [currentUser]
  );

  const pageTitle =
    visibleGroups
      .flatMap((group) => group.items)
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)))?.label || "School ERP";

  function signOut() {
    clearActiveSession();
    navigate("/login");
  }

  return (
    <div className="app-shell theme-dark">
      <button className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <aside className={`sidebar ${sidebarOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">S</div>
          {!collapsed && (
            <div>
              <strong>School ERP</strong>
              <span>{currentUser.campus}</span>
            </div>
          )}
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="nav-stack">
          {visibleGroups.map((group) =>
            group.items.length ? (
              <section key={group.label}>
                {!collapsed && <p className="nav-label">{group.label}</p>}
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link" onClick={() => setSidebarOpen(false)}>
                    <item.icon size={18} />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
              </section>
            ) : null
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="collapse-button" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="main-frame">
        <header className="topbar">
          <div>
            <span className="eyebrow">{currentUser.academicYear}</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <button
              className={location.pathname.startsWith("/notifications") ? "icon-button active" : "icon-button"}
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
              type="button"
            >
              <Bell size={18} />
              {notifications.length > 0 && <span className="notification-dot" />}
            </button>
            <button className="user-chip user-chip-button" type="button" onClick={() => navigate("/profile")}>
              <span className="user-chip-avatar">
                {currentUser.profilePhotoUrl ? <img src={currentUser.profilePhotoUrl} alt="" /> : <UserRound size={17} />}
              </span>
              <span className="user-chip-text">
                <span>{currentUser.name}</span>
                <small>{currentUser.role}</small>
              </span>
            </button>
            <button className="icon-button" onClick={signOut} aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="content-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
