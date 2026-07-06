import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { classNoticesAPI, studentsAPI, teacherAPI } from "../api";
import { canUseRole, getStoredUser } from "../permissions";

const GLOBAL_CLASS_NAME = "__GLOBAL__";

function NoticesPage() {
  const currentUser = getStoredUser();
  const canPublishGlobal = canUseRole(["notices.manage"], currentUser);
  const canPublishClass = canUseRole(["notices.create", "notices.manage"], currentUser);
  const [classes, setClasses] = useState([]);
  const [notices, setNotices] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    scope: "global",
    className: "",
    title: "",
    message: "",
    startDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [teacherForm, setTeacherForm] = useState({
    title: "",
    message: "",
    priority: "normal",
    expiresAt: "",
  });

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      const [classRes, noticeRes] = await Promise.all([
        studentsAPI.getClasses().catch(() => ({ data: [] })),
        classNoticesAPI.getAll().catch(() => ({ data: [] })),
      ]);
      setClasses(classRes.data || []);
      setNotices(noticeRes.data || []);
    } catch {
      setMessage("Notices unavailable.");
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateTeacherForm(field, value) {
    setTeacherForm((current) => ({ ...current, [field]: value }));
  }

  async function saveNotice(event) {
    event.preventDefault();
    if (!canPublishClass) {
      setMessage("Only admin or teacher can publish class notices.");
      return;
    }
    const targetClass = canPublishGlobal && form.scope === "global" ? GLOBAL_CLASS_NAME : form.className;
    if (!targetClass || !form.title || !form.message || !form.startDate || !form.expiryDate) {
      setMessage("Complete all notice fields.");
      return;
    }

    try {
      await classNoticesAPI.create({
        className: targetClass,
        title: form.title,
        message: form.message,
        startDate: form.startDate,
        expiryDate: form.expiryDate,
      });
      setForm((current) => ({ ...current, title: "", message: "" }));
      setMessage("Notice published.");
      await loadPage();
    } catch {
      setMessage("Notice saved locally when backend is available.");
    }
  }

  async function deleteNotice(id) {
    if (!canPublishGlobal) {
      setMessage("Only admin can delete notices.");
      return;
    }
    try {
      await classNoticesAPI.remove(id);
      setNotices((current) => current.filter((notice) => notice._id !== id));
    } catch {
      setMessage("Delete failed.");
    }
  }

  async function saveTeacherAnnouncement(event) {
    event.preventDefault();
    if (!canPublishGlobal) {
      setMessage("Only admin can send teacher instructions.");
      return;
    }
    if (!teacherForm.title || !teacherForm.message) {
      setMessage("Complete teacher instruction title and message.");
      return;
    }

    try {
      await teacherAPI.createAnnouncement({
        title: teacherForm.title,
        message: teacherForm.message,
        priority: teacherForm.priority,
        scope: "teachers",
        expiresAt: teacherForm.expiresAt || undefined,
      });
      setTeacherForm({ title: "", message: "", priority: "normal", expiresAt: "" });
      setMessage("Teacher instruction sent.");
    } catch (error) {
      setMessage(error.response?.data?.error || "Unable to send teacher instruction.");
    }
  }

  return (
    <div className="notices-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Notices</span>
          <h2>Global and class notices.</h2>
        </div>
      </section>

      {message && <div className="inline-alert">{message}</div>}

      <section className="workspace-grid">
        {canPublishClass ? (
          <form className="chart-card" onSubmit={saveNotice}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Publish</span>
                <h3>Notice</h3>
              </div>
            </div>

            {canPublishGlobal && (
              <div className="segmented-control">
                <button className={form.scope === "global" ? "active" : ""} type="button" onClick={() => updateForm("scope", "global")}>All Classes</button>
                <button className={form.scope === "class" ? "active" : ""} type="button" onClick={() => updateForm("scope", "class")}>Single Class</button>
              </div>
            )}

            {(!canPublishGlobal || form.scope === "class") && (
              <label className="field">
                <span>Class</span>
                <select value={form.className} onChange={(event) => updateForm("className", event.target.value)} required>
                  <option value="">Select class</option>
                  {classes.map((className) => <option key={className}>{className}</option>)}
                </select>
              </label>
            )}

            <label className="field">
              <span>Title</span>
              <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
            </label>
            <label className="field">
              <span>Message</span>
              <textarea value={form.message} onChange={(event) => updateForm("message", event.target.value)} rows={4} />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Start date</span>
                <input type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} />
              </label>
              <label className="field">
                <span>Expiry date</span>
                <input type="date" value={form.expiryDate} onChange={(event) => updateForm("expiryDate", event.target.value)} />
              </label>
            </div>
            <button className="primary-button" type="submit"><Plus size={18} /> Publish Notice</button>
          </form>
        ) : (
          <article className="chart-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Read only</span>
                <h3>Notice Access</h3>
              </div>
            </div>
            <div className="empty-state">Only admin or teacher can publish class notices.</div>
          </article>
        )}

        {canPublishGlobal && (
          <form className="chart-card" onSubmit={saveTeacherAnnouncement}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Teachers</span>
                <h3>Instruction</h3>
              </div>
            </div>
            <label className="field">
              <span>Title</span>
              <input value={teacherForm.title} onChange={(event) => updateTeacherForm("title", event.target.value)} />
            </label>
            <label className="field">
              <span>Message</span>
              <textarea value={teacherForm.message} onChange={(event) => updateTeacherForm("message", event.target.value)} rows={4} />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Priority</span>
                <select value={teacherForm.priority} onChange={(event) => updateTeacherForm("priority", event.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="field">
                <span>Expires</span>
                <input type="date" value={teacherForm.expiresAt} onChange={(event) => updateTeacherForm("expiresAt", event.target.value)} />
              </label>
            </div>
            <button className="primary-button" type="submit"><Plus size={18} /> Send to Teachers</button>
          </form>
        )}

        <article className="chart-card wide">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Notice board</span>
              <h3>Active Records</h3>
            </div>
          </div>
          <div className="notice-list">
            {notices.map((notice) => (
              <div className="notice-card" key={notice._id || notice.title}>
                <Megaphone size={18} />
                <div>
                  <strong>{notice.title}</strong>
                  <span>{notice.className === GLOBAL_CLASS_NAME ? "All Classes" : notice.className}</span>
                  <p>{notice.message}</p>
                </div>
                {canPublishGlobal && notice._id && (
                  <button className="icon-button table-icon-action danger" onClick={() => deleteNotice(notice._id)} aria-label="Delete notice">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {notices.length === 0 && <div className="empty-state">No notices.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}

export default NoticesPage;
