// import "./App.css";
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import StudentFormPage from "./pages/StudentFormPage";
import ClassesPage from "./pages/ClassesPage";
import ClassFormPage from "./pages/ClassFormPage";
import ClassDetailPage from "./pages/ClassDetailPage";
import FeesPage from "./pages/FeesPage";
import FeeDetailPage from "./pages/FeeDetailPage";
import AttendancePage from "./pages/AttendancePage";
import AttendanceDetailPage from "./pages/AttendanceDetailPage";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import DocumentsPage from "./pages/DocumentsPage";
import NoticesPage from "./pages/NoticesPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationCenterPage from "./pages/NotificationCenterPage";
import FeeCollectionsPage from "./pages/FeeCollectionsPage";
import UserManagementPage from "./pages/UserManagementPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import StaffAttendancePage from "./pages/StaffAttendancePage";
import SchoolSettingsPage from "./pages/SchoolSettingsPage";
import AuditLogPage from "./pages/AuditLogPage";
import TeacherWorkspacePage from "./pages/TeacherWorkspacePage";
import StaffPayrollPage from "./pages/StaffPayrollPage";
import StaffDirectoryPage from "./pages/StaffDirectoryPage";
import TransportPage from "./pages/TransportPage";
import TransportStudentRecordPage from "./pages/TransportStudentRecordPage";
import TransportVehicleDetailPage from "./pages/TransportVehicleDetailPage";
import WebsiteLeadsPage from "./pages/WebsiteLeadsPage";
import { authAPI, erpAPI } from "./api";
import { allRoles, canUseRole, getStoredUser, hasSession, moduleRoles } from "./permissions";
import { applySchoolBranding } from "./utils/branding";
import { clearActiveSession, updateActiveUser } from "./utils/session";

function App() {
  useEffect(() => {
    let active = true;

    erpAPI
      .list("schoolSettings")
      .then((res) => {
        if (!active) return;
        applySchoolBranding(res.data?.[0]?.payload);
      })
      .catch(() => {
        if (active) applySchoolBranding();
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<RequireRole roles={allRoles}><DashboardPage /></RequireRole>} />
        <Route path="/students" element={<RequireRole roles={["superadmin", "admin", "teacher"]}><StudentsPage /></RequireRole>} />
        <Route path="/students/new" element={<RequireRole roles={["superadmin"]}><StudentFormPage /></RequireRole>} />
        <Route path="/students/:id/edit" element={<RequireRole roles={["superadmin"]}><StudentFormPage /></RequireRole>} />
        <Route path="/students/:id" element={<RequireRole roles={["superadmin", "admin", "teacher", "student", "parent"]}><StudentProfilePage /></RequireRole>} />
        <Route path="/classes" element={<RequireRole roles={["superadmin", "admin", "teacher"]}><ClassesPage /></RequireRole>} />
        <Route path="/classes/new" element={<RequireRole roles={["superadmin", "teacher"]}><ClassFormPage /></RequireRole>} />
        <Route path="/classes/:id/edit" element={<RequireRole roles={["superadmin", "teacher"]}><ClassFormPage /></RequireRole>} />
        <Route path="/classes/:id" element={<RequireRole roles={["superadmin", "admin", "teacher"]}><ClassDetailPage /></RequireRole>} />
        <Route path="/teacher/*" element={<RequireRole roles={["teacher"]}><TeacherWorkspacePage /></RequireRole>} />
        <Route path="fees" element={<RequireRole roles={["superadmin", "accountant", "parent", "student"]}><FeesPage /></RequireRole>} />
        <Route path="fees/collections" element={<RequireRole roles={["superadmin", "accountant"]}><FeeCollectionsPage /></RequireRole>} />
        <Route path="fees/:studentId/:year" element={<RequireRole roles={["superadmin", "accountant", "parent", "student"]}><FeeDetailPage /></RequireRole>} />
        <Route path="attendance" element={<RequireRole roles={["superadmin", "admin", "teacher", "student", "parent"]}><AttendancePage /></RequireRole>} />
        <Route path="attendance/:studentId" element={<RequireRole roles={["superadmin", "admin", "teacher", "student", "parent"]}><AttendanceDetailPage /></RequireRole>} />
        <Route path="staff" element={<RequireRole roles={["superadmin", "admin", "accountant"]}><StaffDirectoryPage /></RequireRole>} />
        <Route path="staff-attendance" element={<RequireRole roles={["superadmin", "admin"]}><StaffAttendancePage /></RequireRole>} />
        <Route path="documents" element={<RequireRole roles={["superadmin", "admin", "staff"]}><DocumentsPage /></RequireRole>} />
        <Route path="notices" element={<RequireRole roles={["superadmin", "admin", "teacher", "staff"]}><NoticesPage /></RequireRole>} />
        <Route path="notifications" element={<RequireRole roles={allRoles}><NotificationCenterPage /></RequireRole>} />
        <Route path="website-leads" element={<RequireRole roles={["superadmin", "admin", "staff"]}><WebsiteLeadsPage /></RequireRole>} />
        <Route path="users" element={<RequireRole roles={["superadmin", "admin"]}><UserManagementPage /></RequireRole>} />
        <Route path="school-settings" element={<RequireRole roles={["superadmin"]}><SchoolSettingsPage /></RequireRole>} />
        <Route path="audit-log" element={<RequireRole roles={["superadmin"]}><AuditLogPage /></RequireRole>} />
        <Route path="profile" element={<RequireRole roles={allRoles}><ProfilePage /></RequireRole>} />
        <Route path="modules/staff/:staffId" element={<RequireRole roles={moduleRoles.staff}><StaffPayrollPage /></RequireRole>} />
        <Route path="modules/transport" element={<RequireRole roles={moduleRoles.transport}><TransportPage /></RequireRole>} />
        <Route path="modules/transport/vehicles/:vehicleId" element={<RequireRole roles={moduleRoles.transport}><TransportVehicleDetailPage /></RequireRole>} />
        <Route path="modules/transport/vehicles/:vehicleId/students/:studentId" element={<RequireRole roles={moduleRoles.transport}><TransportStudentRecordPage /></RequireRole>} />
        <Route path="modules/:moduleId" element={<ModuleRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ children }) {
  const [status, setStatus] = useState(() => (hasSession() ? "checking" : "signed-out"));

  useEffect(() => {
    let active = true;

    if (!hasSession()) {
      setStatus("signed-out");
      return () => {
        active = false;
      };
    }

    authAPI
      .me()
      .then((res) => {
        if (!active) return;
        updateActiveUser(res.data.user);
        setStatus("signed-in");
      })
      .catch(() => {
        if (!active) return;
        clearActiveSession();
        setStatus("signed-out");
      });

    return () => {
      active = false;
    };
  }, []);

  if (status === "signed-out") return <Navigate to="/login" replace />;
  if (status === "checking") return <div className="auth-checking">Checking session...</div>;
  return children;
}

function RequireRole({ roles, children }) {
  const user = getStoredUser();
  if (!canUseRole(roles, user)) return <AccessDenied />;
  return children;
}

function ModuleRoute() {
  const { moduleId } = useParams();
  if (moduleId === "staff") {
    return (
      <RequireRole roles={moduleRoles.staff}>
        <StaffPayrollPage />
      </RequireRole>
    );
  }

  if (moduleId === "transport") {
    return (
      <RequireRole roles={moduleRoles.transport}>
        <TransportPage />
      </RequireRole>
    );
  }

  return (
    <RequireRole roles={moduleRoles[moduleId] || ["admin"]}>
      <ModulePage />
    </RequireRole>
  );
}

function AccessDenied() {
  return (
    <section className="access-denied">
      <span className="eyebrow">Restricted</span>
      <h2>Access Denied</h2>
      <p>Your role does not have permission to open this workspace.</p>
    </section>
  );
}

export default App;
