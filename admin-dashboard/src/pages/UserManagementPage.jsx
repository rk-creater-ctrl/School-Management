import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Crown, Edit3, GraduationCap, RotateCcw, Save, Search, ShieldCheck, Trash2, UserPlus, UserRound, X, XCircle } from "lucide-react";
import { authAPI } from "../api";
import {
  allRoles,
  extractGranularPermissions,
  getPermissionMeta,
  getRolePresetPermissions,
  permissionActionLabels,
  permissionModules,
} from "../permissionCatalog";
import { canUseRole, getEffectivePermissions, getStoredUser, normalizePermissions } from "../permissions";

const roleOptions = allRoles;

function UserManagementPage() {
  const currentUser = getStoredUser();
  const isSuperadmin = currentUser?.role === "superadmin";
  const canReviewPasswords = canUseRole(["users.approve", "users.manage"], currentUser);
  const allowedRoles = isSuperadmin ? roleOptions : ["teacher", "student"];
  const [users, setUsers] = useState([]);
  const [passwordRequests, setPasswordRequests] = useState([]);
  const [status, setStatus] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(createEditState());
  const [form, setForm] = useState(createCreateState(allowedRoles[0]));

  useEffect(() => {
    loadUsers();
    loadPasswordRequests();
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

  async function loadUsers() {
    try {
      const res = await authAPI.listUsers();
      setUsers(res.data || []);
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to load users.");
    }
  }

  async function loadPasswordRequests() {
    if (!canReviewPasswords) return;
    try {
      const res = await authAPI.listPasswordRequests();
      setPasswordRequests(res.data || []);
    } catch {
      setPasswordRequests([]);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCreateRole(role) {
    setForm((current) => ({
      ...current,
      role,
      permissions: getRolePresetPermissions(role),
      permissionMode: "custom",
    }));
  }

  function updateCreatePermissions(permissions) {
    setForm((current) => ({
      ...current,
      permissions,
      permissionMode: "custom",
    }));
  }

  function openEditUser(user) {
    setEditingUser(user);
    setEditForm(createEditState(user));
  }

  function closeEditUser() {
    setEditingUser(null);
    setEditForm(createEditState());
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditRole(role) {
    setEditForm((current) => ({
      ...current,
      role,
      permissions: getRolePresetPermissions(role),
      permissionMode: "custom",
    }));
  }

  function updateEditPermissions(permissions) {
    setEditForm((current) => ({
      ...current,
      permissions,
      permissionMode: "custom",
    }));
  }

  async function createUser(event) {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        role: form.role,
        username: form.username.toLowerCase().replace(/\s/g, ""),
      };
      if (!isSuperadmin) {
        delete payload.permissions;
        delete payload.permissionMode;
      }
      await authAPI.createUser(payload);
      setForm(createCreateState(allowedRoles[0]));
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
        permissions: normalizePermissions(editForm.permissions),
        permissionMode: "custom",
      };
      if (editForm.password) updates.password = editForm.password;

      await authAPI.updateUser(editingUser._id || editingUser.id, {
        password: editForm.superadminPassword,
        updates,
      });
      closeEditUser();
      setStatus("User updated.");
      await loadUsers();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to update user.");
    }
  }

  async function reviewPasswordRequest(request, nextStatus) {
    const reviewNote = nextStatus === "rejected" ? window.prompt("Reason for rejection:") || "" : "";
    try {
      await authAPI.reviewPasswordRequest(request._id || request.id, {
        status: nextStatus,
        reviewNote,
      });
      setStatus(nextStatus === "approved" ? "Password request approved." : "Password request rejected.");
      await loadPasswordRequests();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to review password request.");
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
        <article className="chart-card wide">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Directory</span>
              <h3>Users</h3>
              <p>Click a user row or the edit button to open that user's permissions.</p>
            </div>
          </div>

          <div className="user-role-groups">
            {Object.entries(groupedUsers).map(([role, roleUsers]) => (
              <section className="user-role-group" key={role}>
                <h4>{role}</h4>
                {roleUsers.map((user) => (
                  <button
                    className={editingUser && getUserId(editingUser) === getUserId(user) ? "user-row active" : "user-row"}
                    key={user._id || user.id}
                    onClick={() => openEditUser(user)}
                    type="button"
                  >
                    <UserAvatar user={user} />
                    <div className="user-row-main">
                      <strong>{user.name}</strong>
                      <span>{user.username || user.email}</span>
                      {(user.studentAdmissionNo || user.linkedStudentAdmissionNo) && <span>Linked: {user.studentAdmissionNo || user.linkedStudentAdmissionNo}</span>}
                      <span>{formatPermissionSummary(user)}</span>
                    </div>
                    <small>{user.status || "active"}</small>
                    {isSuperadmin && (
                      <div className="user-row-actions">
                        <button
                          className="icon-button table-icon-action"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditUser(user);
                          }}
                          aria-label="Edit user"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          className="icon-button table-icon-action danger"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteUser(user);
                          }}
                          aria-label="Delete user"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </button>
                ))}
              </section>
            ))}
            {users.length === 0 && <div className="empty-state">No users.</div>}
          </div>
        </article>

        {editingUser && isSuperadmin && (
          <form className="chart-card wide permission-panel" onSubmit={saveUserEdit}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Selected User</span>
                <h3>{editingUser.name}</h3>
                <p>Update user details and adjust exact permissions here.</p>
              </div>
              <button className="icon-button" type="button" onClick={closeEditUser} aria-label="Close">
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
                <select value={editForm.role} onChange={(event) => updateEditRole(event.target.value)}>
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

            <PermissionMatrix
              label="Custom Permissions"
              role={editForm.role}
              permissions={editForm.permissions}
              onChange={updateEditPermissions}
              disabled={editingUser?.role === "superadmin"}
            />

            {editingUser?.role === "superadmin" && (
              <div className="inline-alert">Superadmin already has all permissions.</div>
            )}

            <button className="primary-button" type="submit"><Save size={18} /> Save User</button>
          </form>
        )}

        <form className="chart-card wide permission-panel" onSubmit={createUser}>
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
              <select value={form.role} onChange={(event) => updateCreateRole(event.target.value)}>
                {allowedRoles.map((role) => <option key={role}>{role}</option>)}
              </select>
            </label>
          </div>

          {isSuperadmin && (
            <PermissionMatrix
              label="New User Permissions"
              role={form.role}
              permissions={form.permissions}
              onChange={updateCreatePermissions}
            />
          )}

          <button className="primary-button" type="submit"><UserPlus size={18} /> Create Account</button>
        </form>

        {canReviewPasswords && (
          <article className="chart-card wide password-request-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Approval</span>
                <h3>Password Requests</h3>
              </div>
              <ShieldCheck size={20} />
            </div>

            <div className="password-request-list">
              {passwordRequests.map((request) => (
                <div className="password-request-row" key={request._id || request.id}>
                  <UserAvatar user={request.user} />
                  <div>
                    <strong>{request.user?.name || "Unknown user"}</strong>
                    <span>
                      {request.user?.role || request.requesterRole} request
                      {request.requestedAt ? ` on ${formatDateTime(request.requestedAt)}` : ""}
                    </span>
                    {request.note && <small>{request.note}</small>}
                    {request.reviewNote && <small>Review: {request.reviewNote}</small>}
                  </div>
                  <small className={`status-pill ${request.status || "pending"}`}>{request.status || "pending"}</small>
                  {request.status === "pending" ? (
                    <div className="user-row-actions">
                      <button className="icon-button table-icon-action" type="button" onClick={() => reviewPasswordRequest(request, "approved")} aria-label="Approve password request">
                        <CheckCircle2 size={15} />
                      </button>
                      <button className="icon-button table-icon-action danger" type="button" onClick={() => reviewPasswordRequest(request, "rejected")} aria-label="Reject password request">
                        <XCircle size={15} />
                      </button>
                    </div>
                  ) : (
                    <small>{request.reviewedAt ? formatDateTime(request.reviewedAt) : "-"}</small>
                  )}
                </div>
              ))}
              {passwordRequests.length === 0 && <div className="empty-state">No password requests.</div>}
            </div>
          </article>
        )}
      </section>
    </div>
  );
}

function getUserId(user) {
  return user?._id || user?.id || "";
}

function PermissionMatrix({ label, role, permissions, onChange, disabled = false }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const selectedPermissions = useMemo(() => normalizePermissions(permissions), [permissions]);
  const selectedSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);
  const moduleCount = permissionModules.length;

  const visibleModules = useMemo(
    () =>
      permissionModules
        .map((module) => {
          const permissionsForModule = module.actions
            .map((action) => {
              const permissionId = `${module.key}.${action}`;
              return {
                id: permissionId,
                action,
                actionLabel: permissionActionLabels[action] || action,
                checked: selectedSet.has(permissionId),
              };
            })
            .filter((item) => {
              if (!normalizedQuery) return true;
              return [module.label, item.actionLabel, item.id].some((value) => value.toLowerCase().includes(normalizedQuery));
            });

          return {
            ...module,
            permissions: permissionsForModule,
          };
        })
        .filter((module) => module.permissions.length > 0),
    [normalizedQuery, selectedSet]
  );

  function toggle(permissionId) {
    const next = selectedSet.has(permissionId)
      ? selectedPermissions.filter((item) => item !== permissionId)
      : [...selectedPermissions, permissionId];
    onChange(normalizePermissions(next));
  }

  function setRoleDefaults() {
    onChange(getRolePresetPermissions(role));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <section className="permission-matrix">
      <div className="permission-matrix-header">
        <div>
          <span className="eyebrow">Access Control</span>
          <h4>{label}</h4>
          <p>{selectedPermissions.length} permissions selected across {moduleCount} modules.</p>
        </div>
        <div className="permission-matrix-actions">
          <button className="secondary-button" type="button" onClick={setRoleDefaults} disabled={disabled}>
            <RotateCcw size={16} /> Use {role} defaults
          </button>
          <button className="secondary-button" type="button" onClick={clearAll} disabled={disabled}>
            Clear all
          </button>
        </div>
      </div>

      <label className="field permission-search-field">
        <span>Search permissions</span>
        <div className="search-input-shell">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by module or action" />
        </div>
      </label>

      <div className="permission-module-grid">
        {visibleModules.map((module) => (
          <article className="permission-module-card" key={module.key}>
            <div className="permission-module-head">
              <strong>{module.label}</strong>
              <span>{module.permissions.filter((item) => item.checked).length}/{module.permissions.length}</span>
            </div>
            <div className="permission-option-list">
              {module.permissions.map((permission) => (
                <label className="permission-option" key={permission.id}>
                  <input
                    checked={permission.checked}
                    disabled={disabled}
                    onChange={() => toggle(permission.id)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{permission.actionLabel}</strong>
                    <small>{permission.id}</small>
                  </span>
                </label>
              ))}
            </div>
          </article>
        ))}
        {visibleModules.length === 0 && <div className="empty-state">No permissions match this search.</div>}
      </div>
    </section>
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

function createCreateState(defaultRole) {
  return {
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    studentAdmissionNo: "",
    role: defaultRole,
    permissions: getRolePresetPermissions(defaultRole),
    permissionMode: "custom",
  };
}

function createEditState(user = null) {
  if (!user) {
    return {
      name: "",
      username: "",
      email: "",
      phone: "",
      studentAdmissionNo: "",
      role: "student",
      status: "active",
      password: "",
      superadminPassword: "",
      permissions: getRolePresetPermissions("student"),
      permissionMode: "custom",
    };
  }

  return {
    name: user.name || "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    studentAdmissionNo: user.studentAdmissionNo || user.linkedStudentAdmissionNo || "",
    role: user.role || "student",
    status: user.status || "active",
    password: "",
    superadminPassword: "",
    permissions: getEditablePermissions(user),
    permissionMode: "custom",
  };
}

function getEditablePermissions(user) {
  return normalizePermissions(
    user?.permissionMode === "custom" ? extractGranularPermissions(user.permissions) : getEffectivePermissions(user)
  );
}

function formatPermissionSummary(user) {
  const effectivePermissions = getEffectivePermissions(user);
  if (!effectivePermissions.length) return "No extra permissions assigned.";
  if (user.permissionMode === "custom") return `Custom access: ${effectivePermissions.length} permissions`;

  const preview = effectivePermissions
    .slice(0, 3)
    .map((permission) => getPermissionMeta(permission)?.label || permission)
    .join(", ");
  return `Role defaults: ${preview}${effectivePermissions.length > 3 ? "..." : ""}`;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function UserAvatar({ user }) {
  return (
    <span className="user-list-avatar">
      {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" /> : <UserRound size={18} />}
    </span>
  );
}

export default UserManagementPage;
