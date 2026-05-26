import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Globe2, Mail, Phone, Search, Trash2, X } from "lucide-react";
import { websiteLeadsAPI } from "../api";
import { getStoredUser } from "../permissions";

const statusOptions = ["new", "contacted", "converted", "closed"];
const formTypeOptions = ["all", "admission", "enquiry", "contact"];

function WebsiteLeadsPage() {
  const currentUser = getStoredUser();
  const canDelete = currentUser?.role === "superadmin";
  const [leads, setLeads] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [status, setStatus] = useState("Loading website leads...");
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailDraft, setDetailDraft] = useState({ status: "new", priority: "medium", notes: "" });

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    try {
      const res = await websiteLeadsAPI.getAll({ limit: 300 });
      setLeads(res.data || []);
      setStatus("");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to load website leads.");
    }
  }

  const filteredLeads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesType = typeFilter === "all" || lead.formType === typeFilter;
      const searchable = [
        lead.referenceNo,
        lead.formType,
        lead.childName,
        lead.parentName,
        lead.className,
        lead.phone,
        lead.email,
        lead.subject,
        lead.message,
        lead.status,
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && matchesType && searchable.includes(term);
    });
  }, [leads, query, statusFilter, typeFilter]);

  const stats = useMemo(
    () => [
      { label: "New", value: leads.filter((lead) => lead.status === "new").length },
      { label: "Admissions", value: leads.filter((lead) => lead.formType === "admission").length },
      { label: "Contacted", value: leads.filter((lead) => lead.status === "contacted").length },
      { label: "Converted", value: leads.filter((lead) => lead.status === "converted").length },
    ],
    [leads]
  );

  function openLead(lead) {
    setSelectedLead(lead);
    setDetailDraft({
      status: lead.status || "new",
      priority: lead.priority || "medium",
      notes: lead.notes || "",
    });
  }

  async function saveLeadDetails(event) {
    event.preventDefault();
    if (!selectedLead) return;

    try {
      const res = await websiteLeadsAPI.update(selectedLead._id, detailDraft);
      setLeads((current) => current.map((lead) => (lead._id === selectedLead._id ? res.data : lead)));
      setSelectedLead(res.data);
      setStatus("Lead updated.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to update lead.");
    }
  }

  async function quickStatus(lead, nextStatus) {
    try {
      const res = await websiteLeadsAPI.update(lead._id, { status: nextStatus });
      setLeads((current) => current.map((item) => (item._id === lead._id ? res.data : item)));
      setStatus("Lead status updated.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to update status.");
    }
  }

  async function deleteLead(lead) {
    if (!canDelete || !window.confirm(`Delete ${lead.referenceNo}?`)) return;

    try {
      await websiteLeadsAPI.remove(lead._id);
      setLeads((current) => current.filter((item) => item._id !== lead._id));
      setSelectedLead(null);
      setStatus("Lead deleted.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to delete lead.");
    }
  }

  function exportLeads() {
    const rows = filteredLeads.map((lead) => [
      lead.referenceNo,
      titleCase(lead.formType),
      lead.childName || "",
      lead.parentName || "",
      lead.className || "",
      lead.phone || "",
      lead.email || "",
      titleCase(lead.status),
      formatDate(lead.createdAt),
      lead.subject || "",
    ]);
    downloadCsv("website-leads.csv", [
      ["Reference", "Type", "Child", "Parent", "Class", "Phone", "Email", "Status", "Submitted", "Subject"],
      ...rows,
    ]);
  }

  return (
    <div className="website-leads-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Website</span>
          <h2>Savvy Mother Toddler Leads</h2>
        </div>
        <div className="module-actions">
          <button className="secondary-button" type="button" onClick={loadLeads}>
            <Globe2 size={18} /> Refresh
          </button>
          <button className="primary-button" type="button" onClick={exportLeads}>
            <Download size={18} /> Export
          </button>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="stats-grid compact">
        {stats.map((item) => (
          <article className="metric-card" key={item.label}>
            <div className="metric-icon"><Globe2 size={20} /></div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="website-leads-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, class, phone or email" />
        </div>
        <div className="report-tabs">
          {formTypeOptions.map((type) => (
            <button className={typeFilter === type ? "active" : ""} key={type} onClick={() => setTypeFilter(type)}>
              {type}
            </button>
          ))}
        </div>
        <div className="report-tabs">
          {["all", ...statusOptions].map((item) => (
            <button className={statusFilter === item ? "active" : ""} key={item} onClick={() => setStatusFilter(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="responsive-table website-leads-table">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Student / Parent</th>
              <th>Class</th>
              <th>Contact</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead._id}>
                <td>{lead.referenceNo}</td>
                <td>{titleCase(lead.formType)}</td>
                <td>
                  <strong>{lead.childName || "-"}</strong>
                  <span>{lead.parentName || "-"}</span>
                </td>
                <td>{lead.className || "-"}</td>
                <td>
                  <strong>{lead.phone || "-"}</strong>
                  <span>{lead.email || "-"}</span>
                </td>
                <td>{formatDate(lead.createdAt)}</td>
                <td>
                  <select value={lead.status || "new"} onChange={(event) => quickStatus(lead, event.target.value)}>
                    {statusOptions.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
                  </select>
                </td>
                <td>
                  <div className="table-action-group">
                    <button className="icon-button table-icon-action" type="button" onClick={() => openLead(lead)} aria-label="View lead" title="View">
                      <Eye size={15} />
                    </button>
                    {canDelete && (
                      <button className="icon-button table-icon-action danger" type="button" onClick={() => deleteLead(lead)} aria-label="Delete lead" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan="8">No website leads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {selectedLead && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card website-lead-modal" onSubmit={saveLeadDetails}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">{selectedLead.referenceNo}</span>
                <h3>{selectedLead.childName || selectedLead.parentName || "Website Lead"}</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedLead(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="website-lead-detail-grid">
              <Detail label="Form type" value={titleCase(selectedLead.formType)} />
              <Detail label="Class" value={selectedLead.className} />
              <Detail label="Parent" value={selectedLead.parentName} />
              <Detail label="Phone" value={selectedLead.phone} icon={<Phone size={14} />} />
              <Detail label="Email" value={selectedLead.email} icon={<Mail size={14} />} />
              <Detail label="Submitted" value={formatDate(selectedLead.createdAt)} />
            </div>

            {selectedLead.message && (
              <div className="website-lead-message">
                <span>Message</span>
                <p>{selectedLead.message}</p>
              </div>
            )}

            <div className="form-grid">
              <label className="field">
                <span>Status</span>
                <select value={detailDraft.status} onChange={(event) => setDetailDraft({ ...detailDraft, status: event.target.value })}>
                  {statusOptions.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select value={detailDraft.priority} onChange={(event) => setDetailDraft({ ...detailDraft, priority: event.target.value })}>
                  {["low", "medium", "high", "urgent"].map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
                </select>
              </label>
              <label className="field full-span">
                <span>Staff notes</span>
                <textarea value={detailDraft.notes} onChange={(event) => setDetailDraft({ ...detailDraft, notes: event.target.value })} rows={3} />
              </label>
            </div>

            <details className="website-lead-payload">
              <summary>Full submitted data</summary>
              <pre>{JSON.stringify(selectedLead.payload || {}, null, 2)}</pre>
            </details>

            <div className="module-actions">
              <button className="primary-button" type="submit">Save Lead</button>
              {canDelete && (
                <button className="secondary-button danger-button" type="button" onClick={() => deleteLead(selectedLead)}>
                  <Trash2 size={18} /> Delete
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, icon }) {
  return (
    <div className="website-lead-detail">
      <span>{label}</span>
      <strong>{icon}{value || "-"}</strong>
    </div>
  );
}

function titleCase(value) {
  const text = String(value || "").replace(/-/g, " ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "-";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-";
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

export default WebsiteLeadsPage;
