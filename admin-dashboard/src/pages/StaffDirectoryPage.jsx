import { useEffect, useMemo, useState } from "react";
import { Activity, Edit3, Plus, Save, Trash2, Upload, UserRound, Users, X } from "lucide-react";
import { staffDirectoryAPI, uploadsAPI } from "../api";
import { canUseRole, getStoredUser } from "../permissions";
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
  const canInspectStaff = canUseRole(["superadmin", "admin"], currentUser);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileStaff, setProfileStaff] = useState(null);
  const [profileForm, setProfileForm] = useState(null);
  const [profileStatus, setProfileStatus] = useState("");
  const [profileUploading, setProfileUploading] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [progressStatus, setProgressStatus] = useState("");

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

  async function openProfile(item) {
    if (!canInspectStaff) return;
    setProfileOpen(true);
    setProfileStaff(item);
    setProfileForm(null);
    setProfileStatus("Loading profile.");

    try {
      const res = await staffDirectoryAPI.getProfile(item._id || item.id);
      setProfileForm({
        ...(res.data || {}),
        subjectsText: (res.data?.subjects || []).join(", "),
      });
      setProfileStatus("");
    } catch (error) {
      setProfileStatus(error.response?.data?.error || "Unable to load profile.");
    }
  }

  async function openProgress(item) {
    if (!canInspectStaff) return;
    setProgressOpen(true);
    setProgressData(null);
    setProgressStatus("Loading progress.");

    try {
      const res = await staffDirectoryAPI.getProgress(item._id || item.id);
      setProgressData(res.data || null);
      setProgressStatus("");
    } catch (error) {
      setProgressStatus(error.response?.data?.error || "Unable to load progress.");
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateProfileForm(field, value) {
    setProfileForm((current) => ({ ...current, [field]: value }));
    setProfileStatus("");
  }

  async function uploadProfilePhoto(file) {
    if (!file) return;
    try {
      setProfileUploading(true);
      const res = await uploadsAPI.profilePhoto(file);
      updateProfileForm("profilePhotoUrl", res.data.fileUrl);
      setProfileStatus("Photo uploaded. Save profile to keep it.");
    } catch (error) {
      setProfileStatus(error.response?.data?.error || "Unable to upload photo.");
    } finally {
      setProfileUploading(false);
    }
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

  async function saveStaffProfile(event) {
    event.preventDefault();
    if (!profileStaff || !profileForm) return;

    try {
      const payload = {
        ...profileForm,
        subjects: String(profileForm.subjectsText || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      delete payload.subjectsText;
      await staffDirectoryAPI.updateProfile(profileStaff._id || profileStaff.id, payload);
      setProfileStatus("Profile updated.");
      await loadStaff();
    } catch (error) {
      setProfileStatus(error.response?.data?.error || "Unable to save profile.");
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
                  <div className="staff-person-cell">
                    <StaffAvatar staff={item} />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.username || item.email}</span>
                    </div>
                  </div>
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
                  {canInspectStaff || isSuperadmin ? (
                    <div className="table-action-group">
                      {canInspectStaff && (
                        <>
                          <button className="icon-button table-icon-action" type="button" onClick={() => openProfile(item)} aria-label="Open staff profile" title="Profile">
                            <UserRound size={15} />
                          </button>
                          <button className="icon-button table-icon-action" type="button" onClick={() => openProgress(item)} aria-label="Check staff progress" title="Check progress">
                            <Activity size={15} />
                          </button>
                        </>
                      )}
                      {isSuperadmin && (
                        <>
                          <button className="icon-button table-icon-action" type="button" onClick={() => openEdit(item)} aria-label="Edit staff" title="Edit staff">
                            <Edit3 size={15} />
                          </button>
                          <button className="icon-button table-icon-action danger" type="button" onClick={() => deleteStaff(item)} aria-label="Delete staff" title="Delete staff">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
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

      {profileOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card staff-profile-modal" onSubmit={saveStaffProfile}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Staff Profile</span>
                <h3>{profileStaff?.name || "Profile"}</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setProfileOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {profileStatus && <div className="inline-alert">{profileStatus}</div>}

            {profileForm && (
              <>
                <div className="staff-profile-photo-row">
                  <StaffAvatar staff={profileForm} large />
                  <label className="secondary-button profile-photo-button">
                    <Upload size={16} /> {profileUploading ? "Uploading" : "Upload Photo"}
                    <input
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      hidden
                      type="file"
                      onChange={(event) => uploadProfilePhoto(event.target.files?.[0])}
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <Field label="Name" value={profileForm.name} onChange={(value) => updateProfileForm("name", value)} required />
                  <Field label="Email" type="email" value={profileForm.email} onChange={(value) => updateProfileForm("email", value)} required />
                  <Field label="Mobile" value={profileForm.phone} onChange={(value) => updateProfileForm("phone", value.replace(/\D/g, "").slice(0, 10))} />
                  <Field label="Employee code" value={profileForm.employeeCode} onChange={(value) => updateProfileForm("employeeCode", value.toUpperCase())} />
                  <Field label="Department" value={profileForm.department} onChange={(value) => updateProfileForm("department", value)} />
                  <Field label="Designation" value={profileForm.designation} onChange={(value) => updateProfileForm("designation", value)} />
                  <Field label="Qualification" value={profileForm.qualification} onChange={(value) => updateProfileForm("qualification", value)} />
                  <Field label="Experience years" type="number" value={profileForm.experienceYears} onChange={(value) => updateProfileForm("experienceYears", value)} />
                  <Field label="Alternate phone" value={profileForm.alternatePhone} onChange={(value) => updateProfileForm("alternatePhone", value.replace(/\D/g, "").slice(0, 10))} />
                  <Field label="Subjects" value={profileForm.subjectsText} onChange={(value) => updateProfileForm("subjectsText", value)} />
                  <TextArea label="Address" value={profileForm.address} onChange={(value) => updateProfileForm("address", value)} />
                  <TextArea label="About" value={profileForm.about} onChange={(value) => updateProfileForm("about", value)} />
                </div>

                <button className="primary-button" type="submit"><Save size={18} /> Save Profile</button>
              </>
            )}
          </form>
        </div>
      )}

      {progressOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card staff-progress-modal">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Check Progress</span>
                <h3>{progressData?.staff?.name || "Staff Progress"}</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setProgressOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {progressStatus && <div className="inline-alert">{progressStatus}</div>}

            {progressData && (
              <>
                <section className="stats-grid compact">
                  <ProgressMetric label="Records" value={progressData.summary?.totalRecords || 0} />
                  <ProgressMetric label="Submitted" value={progressData.summary?.submittedRecords || 0} />
                  <ProgressMetric label="Reviewed" value={progressData.summary?.reviewedRecords || 0} />
                  <ProgressMetric label="Completed" value={progressData.summary?.completedPeriods || 0} />
                </section>

                <div className="staff-progress-context">
                  <span>Classes: {progressData.summary?.classes?.join(", ") || "-"}</span>
                  <span>Subjects: {progressData.summary?.subjects?.join(", ") || "-"}</span>
                </div>

                <div className="responsive-table staff-progress-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Class</th>
                        <th>Work</th>
                        <th>Students</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(progressData.records || []).map((record) => (
                        <tr key={record._id || record.id}>
                          <td>{formatDate(record.date)}</td>
                          <td>
                            <strong>{record.className || "-"}</strong>
                            <span>{record.subject || "-"}</span>
                          </td>
                          <td>
                            <strong>{record.taughtToday || record.chapter || record.lessonPlan || "-"}</strong>
                            {record.homeworkText && <span>Homework: {record.homeworkText}</span>}
                            {record.notes && <span>{record.notes}</span>}
                          </td>
                          <td>
                            <strong>Copy: {formatStudentList(record.copySubmittedStudents)}</strong>
                            <span>Exam copy: {formatStudentList(record.examCopyTakenStudents)}</span>
                            {record.copyNaStudentRecords?.length > 0 && (
                              <span>NA: {record.copyNaStudentRecords.map((item) => item.studentName || item.name).filter(Boolean).join(", ")}</span>
                            )}
                          </td>
                          <td>
                            <strong>{record.periodStatus || "pending"}</strong>
                            <span>{record.reviewStatus || "draft"}</span>
                          </td>
                        </tr>
                      ))}
                      {progressData.records?.length === 0 && (
                        <tr>
                          <td colSpan="5">No progress records submitted yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </article>
        </div>
      )}
    </div>
  );
}

function StaffAvatar({ large = false, staff }) {
  return (
    <span className={large ? "staff-avatar large" : "staff-avatar"}>
      {staff?.profilePhotoUrl ? <img src={staff.profilePhotoUrl} alt="" /> : <UserRound size={large ? 28 : 17} />}
    </span>
  );
}

function ProgressMetric({ label, value }) {
  return (
    <article className="metric-card">
      <div className="metric-icon"><Activity size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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

function TextArea({ label, onChange, value }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={3} value={value || ""} onChange={(event) => onChange(event.target.value)} />
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

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStudentList(students = []) {
  if (!students.length) return "-";
  return students.map((student) => student.name || student.admissionNo).filter(Boolean).join(", ");
}

export default StaffDirectoryPage;
