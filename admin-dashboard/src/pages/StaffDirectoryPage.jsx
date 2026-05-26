import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2, Users, X } from "lucide-react";
import { staffDirectoryAPI } from "../api";
import { getStoredUser } from "../permissions";
import { formatCurrency } from "../utils/feeReports";

const roleOptions = ["admin", "teacher", "accountant", "librarian", "staff"];
const statusOptions = ["active", "inactive", "suspended"];
const payrollCategories = ["Skilled", "Half-skilled", "Unskilled"];

const emptyForm = {
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  role: "staff",
  status: "active",
  employeeCode: "",
  payrollCategory: "Skilled",
  department: "",
  designation: "",
  monthlySalary: "",
  includeSundaySalary: true,
  bankName: "",
  accountNo: "",
  ifscCode: "",
};

function StaffDirectoryPage() {
  const currentUser = getStoredUser();
  const isSuperadmin = currentUser?.role === "superadmin";
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    try {
      setLoading(true);
      const res = await staffDirectoryAPI.getAll();
      setStaff(res.data || []);
      setStatus("");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to load staff.");
    } finally {
      setLoading(false);
    }
  }

  const filteredStaff = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return staff;
    return staff.filter((item) =>
      [
        item.employeeCode,
        item.name,
        item.username,
        item.email,
        item.phone,
        item.role,
        item.payrollCategory,
        item.department,
        item.designation,
        item.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [query, staff]);

  const counts = useMemo(
    () =>
      payrollCategories.map((category) => ({
        category,
        count: staff.filter((item) => item.payrollCategory === category).length,
      })),
    [staff]
  );

  function openCreate() {
    if (!isSuperadmin) return;
    setEditingStaff(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(item) {
    if (!isSuperadmin) return;
    setEditingStaff(item);
    setForm({
      ...emptyForm,
      ...item,
      password: "",
      id: undefined,
      _id: undefined,
      monthlySalary: item.monthlySalary || "",
    });
    setFormOpen(true);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function requestPassword(action) {
    if (!isSuperadmin) {
      alert("Only superadmin can perform this action.");
      return "";
    }
    return window.prompt(`Enter superadmin password to ${action}:`) || "";
  }

  async function saveStaff(event) {
    event.preventDefault();
    const superadminPassword = await requestPassword(editingStaff ? "update this staff" : "create this staff");
    if (!superadminPassword) return;

    try {
      const payload = {
        ...form,
        username: form.username.toLowerCase().replace(/\s/g, ""),
        monthlySalary: Number(form.monthlySalary || 0),
        superadminPassword,
      };
      if (editingStaff && !payload.password) delete payload.password;

      if (editingStaff) {
        await staffDirectoryAPI.update(editingStaff._id || editingStaff.id, payload);
        setStatus("Staff updated.");
      } else {
        await staffDirectoryAPI.create(payload);
        setStatus("Staff created.");
      }
      setFormOpen(false);
      setEditingStaff(null);
      await loadStaff();
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save staff.");
    }
  }

  async function deleteStaff(item) {
    const superadminPassword = await requestPassword(`delete ${item.name}`);
    if (!superadminPassword) return;

    try {
      await staffDirectoryAPI.remove(item._id || item.id, superadminPassword);
      setStaff((current) => current.filter((row) => (row._id || row.id) !== (item._id || item.id)));
      setStatus("Staff deleted.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to delete staff.");
    }
  }

  return (
    <div className="staff-directory-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Staff</span>
          <h2>Staff Directory</h2>
        </div>
        {isSuperadmin && (
          <button className="primary-button" type="button" onClick={openCreate}>
            <Plus size={18} /> Add Staff
          </button>
        )}
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="stats-grid compact">
        {counts.map((item) => (
          <article className="metric-card" key={item.category}>
            <div className="metric-icon"><Users size={20} /></div>
            <span>{item.category}</span>
            <strong>{item.count}</strong>
          </article>
        ))}
      </section>

      <section className="table-toolbar staff-directory-toolbar">
        <div className="search-box">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff by name, role, department, code" />
        </div>
      </section>

      <section className="responsive-table staff-directory-table">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Role</th>
              <th>Category</th>
              <th>Department</th>
              <th>Contact</th>
              <th>Salary</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((item) => (
              <tr key={item._id || item.id}>
                <td>{item.employeeCode || "-"}</td>
                <td>
                  <strong>{item.name}</strong>
                  <span>{item.username || item.email}</span>
                </td>
                <td>{item.role}</td>
                <td>{item.payrollCategory}</td>
                <td>
                  <strong>{item.department || "-"}</strong>
                  <span>{item.designation || "-"}</span>
                </td>
                <td>
                  <strong>{item.phone || "-"}</strong>
                  <span>{item.email}</span>
                </td>
                <td>{formatCurrency(item.monthlySalary || 0)}</td>
                <td>{item.status}</td>
                <td>
                  {isSuperadmin ? (
                    <div className="table-action-group">
                      <button className="icon-button table-icon-action" type="button" onClick={() => openEdit(item)} aria-label="Edit staff">
                        <Edit3 size={15} />
                      </button>
                      <button className="icon-button table-icon-action danger" type="button" onClick={() => deleteStaff(item)} aria-label="Delete staff">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {!loading && filteredStaff.length === 0 && (
              <tr>
                <td colSpan="9">No staff found.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="9">Loading staff.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {formOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card staff-directory-modal" onSubmit={saveStaff}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Superadmin</span>
                <h3>{editingStaff ? "Edit Staff" : "Create Staff"}</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="form-grid">
              <Field label="Name" value={form.name} onChange={(value) => updateForm("name", value)} required />
              <Field label="Username" value={form.username} onChange={(value) => updateForm("username", value.toLowerCase().replace(/\s/g, ""))} required />
              <Field label="Email" type="email" value={form.email} onChange={(value) => updateForm("email", value)} required />
              <Field label="Phone" value={form.phone} onChange={(value) => updateForm("phone", value.replace(/\D/g, "").slice(0, 10))} />
              <Field label={editingStaff ? "New login password" : "Login password"} type="password" value={form.password} onChange={(value) => updateForm("password", value)} required={!editingStaff} />
              <Select label="Role" value={form.role} options={roleOptions} onChange={(value) => updateForm("role", value)} />
              <Select label="Status" value={form.status} options={statusOptions} onChange={(value) => updateForm("status", value)} />
              <Field label="Employee code" value={form.employeeCode} onChange={(value) => updateForm("employeeCode", value.toUpperCase())} />
              <Select label="Payroll category" value={form.payrollCategory} options={payrollCategories} onChange={(value) => updateForm("payrollCategory", value)} />
              <Field label="Department" value={form.department} onChange={(value) => updateForm("department", value)} />
              <Field label="Designation" value={form.designation} onChange={(value) => updateForm("designation", value)} />
              <Field label="Monthly salary" type="number" value={form.monthlySalary} onChange={(value) => updateForm("monthlySalary", value)} />
              <Field label="Bank" value={form.bankName} onChange={(value) => updateForm("bankName", value)} />
              <Field label="Account no." value={form.accountNo} onChange={(value) => updateForm("accountNo", value)} />
              <Field label="IFSC" value={form.ifscCode} onChange={(value) => updateForm("ifscCode", value.toUpperCase())} />
              <label className="field staff-directory-check">
                <span>Sunday salary</span>
                <label>
                  <input
                    checked={form.includeSundaySalary}
                    type="checkbox"
                    onChange={(event) => updateForm("includeSundaySalary", event.target.checked)}
                  />
                  Include Sunday salary
                </label>
              </label>
            </div>

            <button className="primary-button" type="submit">{editingStaff ? "Update Staff" : "Create Staff"}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, onChange, required, type = "text", value }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function Select({ label, onChange, options, value }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default StaffDirectoryPage;
