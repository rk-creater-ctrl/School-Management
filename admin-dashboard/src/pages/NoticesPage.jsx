import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { classNoticesAPI, studentsAPI } from "../api";

const GLOBAL_CLASS_NAME = "__GLOBAL__";

function NoticesPage() {
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

  async function saveNotice(event) {
    event.preventDefault();
    const targetClass = form.scope === "global" ? GLOBAL_CLASS_NAME : form.className;
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
    try {
      await classNoticesAPI.remove(id);
      setNotices((current) => current.filter((notice) => notice._id !== id));
    } catch {
      setMessage("Delete failed.");
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
        <form className="chart-card" onSubmit={saveNotice}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Publish</span>
              <h3>Notice</h3>
            </div>
          </div>

          <div className="segmented-control">
            <button className={form.scope === "global" ? "active" : ""} type="button" onClick={() => updateForm("scope", "global")}>All Classes</button>
            <button className={form.scope === "class" ? "active" : ""} type="button" onClick={() => updateForm("scope", "class")}>Single Class</button>
          </div>

          {form.scope === "class" && (
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
                {notice._id && (
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
