import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  BellRing,
  BookMarked,
  BrainCircuit,
  CheckCircle2,
  Edit3,
  FileDown,
  FileText,
  Filter,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { erpAPI } from "../api";

const statusOptions = ["Active", "Enquiry", "Pending", "Approved", "Reviewed", "Rejected", "Completed", "Due", "Returned"];

const moduleCatalog = {
  admissions: {
    title: "Admissions",
    description: "Manage enquiries, applications, document verification, approvals, and admission numbers.",
    workflows: ["Professional enquiry", "Application form", "Document verification", "Approval", "Admission number"],
    fields: {
      title: "Student name",
      groupName: "Applying for class",
      note: "Admission note",
      extras: [
        { name: "entryType", label: "Entry type", type: "select", options: ["Enquiry", "Application", "Confirmed admission"] },
        { name: "enquirySource", label: "Enquiry source", placeholder: "Walk-in, phone, website, referral" },
        { name: "parentName", label: "Parent / guardian", placeholder: "Parent name" },
        { name: "contactNo", label: "Contact number", placeholder: "Mobile number" },
        { name: "previousSchool", label: "Previous school", placeholder: "Previous school name" },
      ],
    },
  },
  staff: {
    title: "Staff & Payroll",
    description: "Manage staff profiles, payroll category, salary slips, leave, departments, and attendance.",
    workflows: ["Staff profile", "Payroll category", "Attendance", "Payroll approval", "Salary slip"],
    fields: {
      title: "Staff name",
      groupName: "Department",
      note: "Joining / HR note",
      extras: [
        { name: "payrollCategory", label: "Payroll category", type: "select", options: ["Skilled", "Unskilled", "Half-skilled"] },
        { name: "designation", label: "Designation", placeholder: "Teacher, accountant, librarian" },
        { name: "subject", label: "Subject / responsibility", placeholder: "Mathematics, accounts, library" },
        { name: "phone", label: "Phone", placeholder: "Mobile number" },
      ],
    },
  },
  exams: {
    title: "Exams & Results",
    description: "Create schedules, enter marks, define grades, and prepare report cards.",
    workflows: ["Exam schedule", "Marks entry", "Grade rules", "Result calculation", "Report card"],
    fields: {
      title: "Exam name",
      groupName: "Class / section",
      note: "Exam note",
      extras: [
        { name: "subject", label: "Subject", placeholder: "Science" },
        { name: "examDate", label: "Exam date", type: "date" },
        { name: "maxMarks", label: "Maximum marks", type: "number", placeholder: "100" },
      ],
    },
  },
  lms: {
    title: "Learning",
    description: "Courses, live class links, lectures, quizzes, assignments, notes, and progress.",
    workflows: ["Course", "Live link", "Recorded lecture", "Quiz", "Submission"],
    fields: {
      title: "Course / class title",
      groupName: "Class / batch",
      note: "Learning note",
      extras: [
        { name: "instructor", label: "Instructor", placeholder: "Teacher name" },
        { name: "liveLink", label: "Live class link", type: "url", placeholder: "https://..." },
        { name: "resourceType", label: "Resource type", placeholder: "Video, notes, quiz" },
      ],
    },
  },
  transport: {
    title: "Transport",
    description: "Routes, buses, drivers, pickup points, drop alerts, and transport dues.",
    workflows: ["Route", "Vehicle", "Driver", "Pickup/drop alert", "Transport fee"],
    fields: {
      title: "Route name",
      groupName: "Bus / vehicle number",
      note: "Transport note",
      extras: [
        { name: "driverName", label: "Driver name", placeholder: "Driver name" },
        { name: "pickupArea", label: "Pickup area", placeholder: "Area or stop" },
        { name: "capacity", label: "Capacity", type: "number", placeholder: "40" },
      ],
    },
  },
  library: {
    title: "Library",
    description: "Books, issue-return, fines, search, and availability.",
    workflows: ["Book inventory", "Barcode/RFID", "Issue", "Return", "Fine"],
    fields: {
      title: "Book title",
      groupName: "Category / shelf",
      note: "Library note",
      extras: [
        { name: "author", label: "Author", placeholder: "Author name" },
        { name: "accessionNo", label: "Accession / barcode no.", placeholder: "LIB-001" },
        { name: "issuedTo", label: "Issued to", placeholder: "Student or staff name" },
      ],
    },
  },
  inventory: {
    title: "Inventory",
    description: "Track assets, stock checkout, due items, vendors, and school service dues.",
    workflows: ["Stock entry", "Checkout", "Due tracking", "Return", "Vendor record"],
    fields: {
      title: "Asset / item name",
      groupName: "Location / category",
      note: "Checkout / due note",
      extras: [
        { name: "movementType", label: "Module", type: "select", options: ["Stock checkout", "Bus due", "Lab due", "School fees due", "ID card due", "TC due"] },
        { name: "quantity", label: "Quantity", type: "number", placeholder: "1" },
        { name: "custodian", label: "Taken by / responsible person", placeholder: "Sports teacher, lab incharge, student name" },
        { name: "movementDate", label: "Date", type: "date" },
        { name: "dueAmount", label: "Due amount", type: "number", placeholder: "0" },
      ],
    },
  },
};

function ModulePage() {
  const { moduleId } = useParams();
  const data = moduleCatalog[moduleId] || moduleCatalog.admissions;
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadNote, setUploadNote] = useState("");
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [form, setForm] = useState(createEmptyForm(moduleId, data));
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Route change should clear stale rows before loading module data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecords([]);
    setFormOpen(false);
    setEditingRecordId(null);
    setForm(createEmptyForm(moduleId, data));
    erpAPI
      .list(moduleId)
      .then((res) => {
        setRecords((res.data || []).map(toTableRecord));
      })
      .catch(() => {
        setUploadNote("Live records unavailable.");
      });
  }, [moduleId, data]);

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const searchable = [
          record.referenceNo,
          record.title,
          record.groupName,
          record.status,
          record.note,
          ...Object.values(record.payload || {}),
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = searchable.includes(query.toLowerCase());
        const matchesStatus = statusFilter === "all" || record.status.toLowerCase().includes(statusFilter.toLowerCase());
        return matchesQuery && matchesStatus;
      }),
    [records, query, statusFilter]
  );

  const computedStats = useMemo(() => {
    const pending = records.filter((record) => record.status.toLowerCase().includes("pending")).length;
    const approved = records.filter((record) => record.status.toLowerCase().includes("approved")).length;
    const reviewed = records.filter((record) => record.status.toLowerCase().includes("reviewed")).length;
    return [
      ["Total records", records.length],
      ["Pending", pending],
      ["Approved", approved],
      ["Reviewed", reviewed],
    ];
  }, [records]);

  function openNewRecord() {
    setEditingRecordId(null);
    setForm(createEmptyForm(moduleId, data));
    setFormOpen(true);
  }

  function openEditRecord(record) {
    setEditingRecordId(record.localId);
    setForm({
      referenceNo: record.referenceNo,
      title: record.title,
      groupName: record.groupName === "-" ? "" : record.groupName,
      status: record.status,
      note: record.note === "-" ? "" : record.note,
      payload: { ...record.payload },
    });
    setFormOpen(true);
  }

  async function saveRecord(event) {
    event.preventDefault();
    const existing = records.find((record) => record.localId === editingRecordId);
    const optimisticRecord = {
      ...form,
      localId: existing?.localId || form.referenceNo,
      id: existing?.id,
      payload: { ...form.payload, action: form.note },
    };

    setRecords((current) =>
      existing
        ? current.map((record) => (record.localId === editingRecordId ? optimisticRecord : record))
        : [optimisticRecord, ...current]
    );
    setFormOpen(false);
    setEditingRecordId(null);

    const payload = {
      referenceNo: form.referenceNo,
      title: form.title,
      groupName: form.groupName,
      status: form.status,
      payload: { ...form.payload, action: form.note },
    };

    try {
      if (existing?.id) {
        const res = await erpAPI.update(moduleId, existing.id, payload);
        setRecords((current) => current.map((record) => (record.localId === optimisticRecord.localId ? toTableRecord(res.data) : record)));
      } else {
        const res = await erpAPI.create(moduleId, payload);
        setRecords((current) => current.map((record) => (record.localId === optimisticRecord.localId ? toTableRecord(res.data) : record)));
      }
    } catch {
      setUploadNote(existing ? "Updated locally." : "Saved locally.");
    }
  }

  async function deleteRecord(record) {
    setRecords((current) => current.filter((item) => item.localId !== record.localId));
    if (!record.id) return;
    try {
      await erpAPI.remove(moduleId, record.id);
    } catch {
      setUploadNote("Deleted locally.");
    }
  }

  function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadNote(`${file.name} attached.`);
    event.target.value = "";
  }

  function exportRecords() {
    const rows = filteredRecords.map((record) => [
      record.referenceNo,
      record.title,
      record.groupName,
      record.status,
      record.note,
      ...data.fields.extras.map((field) => record.payload?.[field.name] || ""),
    ]);
    downloadCsv(
      `${moduleId || "module"}-records.csv`,
      [["ID", data.fields.title, data.fields.groupName, "Status", data.fields.note, ...data.fields.extras.map((field) => field.label)], ...rows]
    );
  }

  async function advanceRecord(record) {
    const nextStatus = record.status.toLowerCase().includes("approved") || record.status.toLowerCase().includes("active") ? "Reviewed" : "Approved";
    const nextRecord = { ...record, status: nextStatus, note: "Updated now", payload: { ...record.payload, action: "Updated now" } };
    setRecords((current) => current.map((item) => (item.localId === record.localId ? nextRecord : item)));
    if (record.id) {
      try {
        await erpAPI.update(moduleId, record.id, { status: nextStatus, payload: nextRecord.payload });
      } catch {
        setUploadNote("Status updated locally.");
      }
    }
  }

  return (
    <div className="module-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Workspace</span>
          <h2>{data.title}</h2>
          <div className="module-option-strip">
            {data.workflows.slice(0, 4).map((workflow) => (
              <button className="chip" key={workflow} type="button" onClick={openNewRecord}>
                {workflow}
              </button>
            ))}
          </div>
        </div>
        <div className="module-actions">
          <button className="primary-button" onClick={openNewRecord}><Plus size={18} /> New record</button>
          <button className="secondary-button" onClick={() => fileInputRef.current?.click()}><UploadCloud size={18} /> Upload</button>
          <button className="secondary-button" onClick={exportRecords}><FileDown size={18} /> Export</button>
          <input ref={fileInputRef} type="file" className="hidden-input" onChange={handleUpload} />
        </div>
      </section>
      {uploadNote && <div className="inline-alert">{uploadNote}</div>}

      <section className="stats-grid compact">
        {computedStats.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small><CheckCircle2 size={14} /> Live</small>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <article className="chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Options</span>
              <h3>Actions</h3>
            </div>
          </div>
          <div className="module-option-grid">
            {data.workflows.map((workflow, index) => (
              <button className="module-option-card" key={workflow} type="button" onClick={openNewRecord}>
                <span>{index + 1}</span>
                <strong>{workflow}</strong>
              </button>
            ))}
          </div>
        </article>

        <article className="chart-card wide">
          <div className="table-toolbar">
            <div className="search-box">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" />
            </div>
            <button className="ghost-button" onClick={() => setFilterOpen((value) => !value)}><Filter size={16} /> Filter</button>
          </div>
          {filterOpen && (
            <div className="filter-strip">
              {["all", "active", "approved", "pending", "reviewed"].map((status) => (
                <button key={status} className={statusFilter === status ? "chip active" : "chip"} onClick={() => setStatusFilter(status)}>
                  {status}
                </button>
              ))}
            </div>
          )}
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{data.fields.title}</th>
                  <th>{data.fields.groupName}</th>
                  <th>Status</th>
                  <th>{data.fields.note}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.localId}>
                    <td>{record.referenceNo}</td>
                    <td>{record.title}</td>
                    <td>{record.groupName}</td>
                    <td>{record.status}</td>
                    <td>{record.note}</td>
                    <td>
                      <div className="table-action-group">
                        <button className="ghost-button table-action" onClick={() => advanceRecord(record)}>Advance</button>
                        <button className="icon-button table-icon-action" onClick={() => openEditRecord(record)} aria-label="Edit record" title="Edit">
                          <Edit3 size={15} />
                        </button>
                        <button className="icon-button table-icon-action danger" onClick={() => deleteRecord(record)} aria-label="Delete record" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="6">No records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Alerts</span>
              <h3>Communication</h3>
            </div>
          </div>
          <div className="insight-list">
            <Signal icon={BellRing} text="Push and in-app alerts" />
            <Signal icon={MessageCircle} text="WhatsApp/SMS reminders" />
            <Signal icon={FileText} text="PDF/Excel exports" />
            <Signal icon={BrainCircuit} text="Priority checks" />
            <Signal icon={BookMarked} text="Change history" />
          </div>
        </article>
      </section>

      {formOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={saveRecord}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">{data.title}</span>
                <h3>{editingRecordId ? "Edit record" : "New record"}</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setFormOpen(false)}>x</button>
            </div>
            <label className="field">
              <span>Reference ID</span>
              <input value={form.referenceNo} onChange={(event) => setForm({ ...form, referenceNo: event.target.value })} required />
            </label>
            <label className="field">
              <span>{data.fields.title}</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required autoFocus />
            </label>
            <label className="field">
              <span>{data.fields.groupName}</span>
              <input value={form.groupName} onChange={(event) => setForm({ ...form, groupName: event.target.value })} required />
            </label>
            <label className="field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {statusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            {data.fields.extras.map((field) => (
              <label className="field" key={field.name}>
                <span>{field.label}</span>
                {field.type === "select" ? (
                  <select
                    value={form.payload[field.name] || field.options?.[0] || ""}
                    onChange={(event) => setForm({ ...form, payload: { ...form.payload, [field.name]: event.target.value } })}
                  >
                    {(field.options || []).map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type || "text"}
                    value={form.payload[field.name] || ""}
                    onChange={(event) => setForm({ ...form, payload: { ...form.payload, [field.name]: event.target.value } })}
                    placeholder={field.placeholder}
                  />
                )}
              </label>
            ))}
            <label className="field">
              <span>{data.fields.note}</span>
              <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} rows={3} required />
            </label>
            <button className="primary-button" type="submit">{editingRecordId ? "Update record" : "Save record"}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function createEmptyForm(moduleId, data) {
  return {
    referenceNo: `${moduleId?.toUpperCase() || "ERP"}-${Date.now().toString().slice(-5)}`,
    title: "",
    groupName: "",
    status: "Active",
    note: "",
    payload: data.fields.extras.reduce((values, field) => ({ ...values, [field.name]: field.type === "select" ? field.options?.[0] || "" : "" }), {}),
  };
}

function toTableRecord(record) {
  return {
    referenceNo: record.referenceNo,
    title: record.title,
    groupName: record.groupName || "-",
    status: record.status || "active",
    note: record.payload?.action || record.priority || "-",
    payload: record.payload || {},
    id: record._id,
    localId: record._id || record.referenceNo,
  };
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

function Signal({ icon, text }) {
  return (
    <div className="signal-row">
      {createElement(icon, { size: 17 })}
      <span>{text}</span>
    </div>
  );
}

export default ModulePage;
