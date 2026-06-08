import { useEffect, useMemo, useState } from "react";
import { Crown, Edit3, GraduationCap, Save, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { authAPI } from "../api";
import { getStoredUser, normalizePermissions } from "../permissions";

const roleOptions = ["superadmin", "admin", "teacher", "student", "parent", "accountant", "librarian", "staff"];
const permissionOptions = [
  {
    value: "admin",
    label: "Admin tools",
    detail: "Students, classes, attendance, notices, website leads, and transport admin access.",
  },
  {
    value: "teacher",
    label: "Teacher tools",
    detail: "Teacher desk, classes, attendance, exams, LMS, and teacher notices.",
  },
  {
    value: "accountant",
    label: "Accounts tools",
    detail: "Fees, collections, staff payroll, and transport fee collection.",
  },
  {
    value: "staff",
    label: "Staff tools",
    detail: "Documents, admissions, website leads, notices, transport, and inventory.",
  },
  {
    value: "librarian",
    label: "Library tools",
    detail: "Library workspace access.",
  },
];

function UserManagementPage() {
  const currentUser = getStoredUser();
  const isSuperadmin = currentUser?.role === "superadmin";
  const allowedRoles = isSuperadmin ? roleOptions : ["teacher", "student"];
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    studentAdmissionNo: "",
    role: "student",
    status: "active",
    password: "",
    superadminPassword: "",
  });
  const [permissionForm, setPermissionForm] = useState({
    userId: "",
    permissions: [],
    superadminPassword: "",
  });
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    studentAdmissionNo: "",
    role: allowedRoles[0],
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const groupedUsers = useMemo(
    () =>
      users.reduce((groups, user) => {
        const role = user.role || "user";
        groups[role] = [...(groups[role] || []), user];
        return groups;
      }, {}),
    [users]
  );
  const selectedPermissionUser = useMemo(
    () => users.find((user) => getUserId(user) === permissionForm.userId) || null,
    [permissionForm.userId, users]
  );

  async function loadUsers() {
    try {
      const res = await authAPI.listUsers();
      setUsers(res.data || []);
      setPermissionForm((current) => {
        const nextUsers = res.data || [];
        if (current.userId && nextUsers.some((user) => getUserId(user) === current.userId)) return current;
        const firstUser = nextUsers.find((user) => user.role !== "superadmin") || nextUsers[0];
        return firstUser
          ? {
              ...current,
              userId: getUserId(firstUser),
              permissions: normalizePermissions(firstUser.permissions),
            }
          : current;
      });
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to load users.");
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openEditUser(user) {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      studentAdmissionNo: user.studentAdmissionNo || user.linkedStudentAdmissionNo || "",
      role: user.role || "student",
      status: user.status || "active",
      password: "",
      superadminPassword: "",
    });
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  function selectPermissionUser(userId) {
    const user = users.find((item) => getUserId(item) === userId);
    setPermissionForm({
      userId,
      permissions: normalizePermissions(user?.permissions),
      superadminPassword: "",
    });
  }

  function togglePermission(permission) {
    setPermissionForm((current) => {
      const permissions = normalizePermissions(current.permissions);
      const nextPermissions = permissions.includes(permission)
        ? permissions.filter((item) => item !== permission)
        : [...permissions, permission];
      return { ...current, permissions: nextPermissions };
    });
  }

  function updatePermissionPassword(value) {
    setPermissionForm((current) => ({ ...current, superadminPassword: value }));
  }

  async function createUser(event) {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        role: form.role,
        username: form.username.toLowerCase().replace(/\s/g, ""),
      };
      await authAPI.createUser(payload);
      setForm({ name: "", username: "", email: "", phone: "", password: "", studentAdmissionNo: "", role: allowedRoles[0] });
      setStatus("User account created.");
      await loadUsers();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to create user.");
    }
  }

  async function deleteUser(user) {
    if (!isSuperadmin) return;
    const password = window.prompt(`Enter superadmin password to delete ${user.name}:`);
    if (!password) return;

    try {
      await authAPI.deleteUser(user._id || user.id, password);
      setUsers((current) => current.filter((item) => (item._id || item.id) !== (user._id || user.id)));
      setStatus("User deleted.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to delete user.");
    }
  }

  async function saveUserEdit(event) {
    event.preventDefault();
    if (!editingUser || !isSuperadmin) return;

    try {
      const updates = {
        name: editForm.name,
        username: editForm.username.toLowerCase().replace(/\s/g, ""),
        email: editForm.email,
        phone: editForm.phone,
        studentAdmissionNo: editForm.studentAdmissionNo,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password) updates.password = editForm.password;

      await authAPI.updateUser(editingUser._id || editingUser.id, {
        password: editForm.superadminPassword,
        updates,
      });
      setEditingUser(null);
      setStatus("User updated.");
      await loadUsers();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to update user.");
    }
  }

  async function savePermissions(event) {
    event.preventDefault();
    if (!isSuperadmin || !permissionForm.userId) return;

    try {
      await authAPI.updateUser(permissionForm.userId, {
        password: permissionForm.superadminPassword,
        updates: {
          permissions: normalizePermissions(permissionForm.permissions),
        },
      });
      setPermissionForm((current) => ({ ...current, superadminPassword: "" }));
      setStatus("User permissions saved.");
      await loadUsers();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save permissions.");
    }
  }

  return (
    <div className="users-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Users</span>
          <h2>{isSuperadmin ? "User & Admin Control" : "Teacher & Student Accounts"}</h2>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="workspace-grid">
        <form className="chart-card" onSubmit={createUser}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Create</span>
              <h3>Login Account</h3>
            </div>
            {isSuperadmin ? <Crown size={20} /> : <GraduationCap size={20} />}
          </div>

          <div className="form-grid">
            <Field label="Name" value={form.name} onChange={(value) => updateForm("name", value)} required />
            <Field label="Username" value={form.username} onChange={(value) => updateForm("username", value.toLowerCase().replace(/\s/g, ""))} required />
            <Field label="Email" type="email" value={form.email} onChange={(value) => updateForm("email", value)} required />
            <Field label="Mobile" value={form.phone} onChange={(value) => updateForm("phone", value.replace(/\D/g, "").slice(0, 10))} />
            <Field label="Password" type="password" value={form.password} onChange={(value) => updateForm("password", value)} required />
            <Field label="Linked admission no" value={form.studentAdmissionNo} onChange={(value) => updateForm("studentAdmissionNo", value)} />
            <label className="field">
              <span>Role</span>
              <select value={form.role} onChange={(event) => updateForm("role", event.target.value)}>
                {allowedRoles.map((role) => <option key={role}>{role}</option>)}
              </select>
            </label>
          </div>

          <button className="primary-button" type="submit"><UserPlus size={18} /> Create Account</button>
        </form>

        {isSuperadmin && (
          <form className="chart-card permission-panel" onSubmit={savePermissions}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Superadmin</span>
                <h3>Permission Panel</h3>
              </div>
              <ShieldCheck size={20} />
            </div>

            <label className="field">
              <span>User</span>
              <select value={permissionForm.userId} onChange={(event) => selectPermissionUser(event.target.value)}>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={getUserId(user)} value={getUserId(user)}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </label>

            {selectedPermissionUser && (
              <div className="permission-user-card">
                <strong>{selectedPermissionUser.name}</strong>
                <span>{selectedPermissionUser.username || selectedPermissionUser.email}</span>
              </div>
            )}

            <div className="permission-option-list">
              {permissionOptions.map((permission) => (
                <label className="permission-option" key={permission.value}>
                  <input
                    checked={permissionForm.permissions.includes(permission.value)}
                    disabled={selectedPermissionUser?.role === "superadmin"}
                    onChange={() => togglePermission(permission.value)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{permission.label}</strong>
                    <small>{permission.detail}</small>
                  </span>
                </label>
              ))}
            </div>

            {selectedPermissionUser?.role === "superadmin" && (
              <div className="inline-alert">Superadmin already has all permissions.</div>
            )}

            <Field
              label="Superadmin password"
              type="password"
              value={permissionForm.superadminPassword}
              onChange={updatePermissionPassword}
              required
            />
            <button className="primary-button" type="submit" disabled={!permissionForm.userId}>
              <Save size={18} /> Save Permissions
            </button>
          </form>
        )}

        <article className="chart-card wide">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Directory</span>
              <h3>Users</h3>
            </div>
          </div>

          <div className="user-role-groups">
            {Object.entries(groupedUsers).map(([role, roleUsers]) => (
              <section className="user-role-group" key={role}>
                <h4>{role}</h4>
                {roleUsers.map((user) => (
                  <div className="user-row" key={user._id || user.id}>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.username || user.email}</span>
                      {(user.studentAdmissionNo || user.linkedStudentAdmissionNo) && <span>Linked: {user.studentAdmissionNo || user.linkedStudentAdmissionNo}</span>}
                      {normalizePermissions(user.permissions).length > 0 && (
                        <span>Permissions: {formatPermissions(user.permissions)}</span>
                      )}
                    </div>
                    <small>{user.status || "active"}</small>
                    {isSuperadmin && (
                      <div className="user-row-actions">
                        <button className="icon-button table-icon-action" onClick={() => openEditUser(user)} aria-label="Edit user">
                          <Edit3 size={15} />
                        </button>
                        <button className="icon-button table-icon-action danger" onClick={() => deleteUser(user)} aria-label="Delete user">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            ))}
            {users.length === 0 && <div className="empty-state">No users.</div>}
          </div>
        </article>
      </section>

      {editingUser && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card user-edit-modal" onSubmit={saveUserEdit}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Superadmin</span>
                <h3>Edit User</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditingUser(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="form-grid">
              <Field label="Name" value={editForm.name} onChange={(value) => updateEditForm("name", value)} required />
              <Field label="Username" value={editForm.username} onChange={(value) => updateEditForm("username", value.toLowerCase().replace(/\s/g, ""))} required />
              <Field label="Email" type="email" value={editForm.email} onChange={(value) => updateEditForm("email", value)} required />
              <Field label="Mobile" value={editForm.phone} onChange={(value) => updateEditForm("phone", value.replace(/\D/g, "").slice(0, 10))} />
              <Field label="Linked admission no" value={editForm.studentAdmissionNo} onChange={(value) => updateEditForm("studentAdmissionNo", value)} />
              <label className="field">
                <span>Role</span>
                <select value={editForm.role} onChange={(event) => updateEditForm("role", event.target.value)}>
                  {roleOptions.map((role) => <option key={role}>{role}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select value={editForm.status} onChange={(event) => updateEditForm("status", event.target.value)}>
                  <option>active</option>
                  <option>inactive</option>
                  <option>suspended</option>
                </select>
              </label>
              <Field label="New password" type="password" value={editForm.password} onChange={(value) => updateEditForm("password", value)} />
              <Field label="Superadmin password" type="password" value={editForm.superadminPassword} onChange={(value) => updateEditForm("superadminPassword", value)} required />
            </div>

            <button className="primary-button" type="submit"><Save size={18} /> Save User</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function getUserId(user) {
  return user?._id || user?.id || "";
}

function formatPermissions(permissions) {
  const labels = new Map(permissionOptions.map((permission) => [permission.value, permission.label]));
  return normalizePermissions(permissions)
    .map((permission) => labels.get(permission) || permission)
    .join(", ");
}

export default UserManagementPage;
