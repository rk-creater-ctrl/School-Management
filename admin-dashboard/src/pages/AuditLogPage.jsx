import { useEffect, useMemo, useState } from "react";
import { Download, Filter, History, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { erpAPI } from "../api";

const actionLabels = ["all", "create", "update", "delete"];
const roleLabels = ["all", "superadmin", "admin", "teacher", "student", "parent", "accountant", "librarian", "staff"];

function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [status, setStatus] = useState("Loading audit logs...");

  useEffect(() => {
    let active = true;

    erpAPI
      .auditLogs({ limit: 300 })
      .then((res) => {
        if (!active) return;
        setLogs(res.data || []);
        setStatus("");
      })
      .catch((error) => {
        if (active) setStatus(error.response?.data?.error || "Unable to load audit logs.");
      });

    return () => {
      active = false;
    };
  }, []);

  const moduleOptions = useMemo(() => ["all", ...new Set(logs.map((log) => log.module).filter(Boolean))], [logs]);

  const filteredLogs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const matchesRole = roleFilter === "all" || log.actorRole === roleFilter;
      const matchesModule = moduleFilter === "all" || log.module === moduleFilter;
      const searchable = [
        actorName(log),
        log.actorRole,
        log.action,
        log.module,
        log.entityId,
        metadataSummary(log.metadata),
      ]
        .join(" ")
        .toLowerCase();

      return matchesAction && matchesRole && matchesModule && searchable.includes(term);
    });
  }, [actionFilter, logs, moduleFilter, query, roleFilter]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return logs.filter((log) => new Date(log.createdAt).toDateString() === today).length;
  }, [logs]);

  const stats = [
    { label: "Total Logs", value: logs.length },
    { label: "Today", value: todayCount },
    { label: "Updates", value: logs.filter((log) => log.action === "update").length },
    { label: "Deletes", value: logs.filter((log) => log.action === "delete").length },
  ];

  function refreshLogs() {
    setStatus("Refreshing audit logs...");
    erpAPI
      .auditLogs({ limit: 300 })
      .then((res) => {
        setLogs(res.data || []);
        setStatus("");
      })
      .catch((error) => setStatus(error.response?.data?.error || "Unable to refresh audit logs."));
  }

  function exportCsv() {
    const rows = [
      ["Time", "Actor", "Role", "Action", "Module", "Entity", "Details", "IP"],
      ...filteredLogs.map((log) => [
        formatDate(log.createdAt),
        actorName(log),
        log.actorRole,
        log.action,
        log.module,
        log.entityId,
        metadataSummary(log.metadata),
        log.ipAddress,
      ]),
    ];
    downloadCsv("audit-log.csv", rows);
  }

  return (
    <div className="audit-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Superadmin</span>
          <h2>Audit Log</h2>
        </div>
        <div className="module-actions">
          <button className="secondary-button" type="button" onClick={refreshLogs}>
            <RefreshCw size={18} /> Refresh
          </button>
          <button className="secondary-button" type="button" onClick={exportCsv}>
            <Download size={18} /> Export CSV
          </button>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="stats-grid compact">
        {stats.map((item) => (
          <article className="metric-card" key={item.label}>
            <div className="metric-icon"><ShieldCheck size={20} /></div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <article className="chart-card wide">
          <div className="table-toolbar audit-toolbar">
            <div className="search-box">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search audit logs" />
            </div>
            <div className="audit-filters">
              <Filter size={16} />
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                {actionLabels.map((action) => <option key={action}>{action}</option>)}
              </select>
              <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
                {moduleOptions.map((module) => <option key={module}>{module}</option>)}
              </select>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                {roleLabels.map((role) => <option key={role}>{role}</option>)}
              </select>
            </div>
          </div>

          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log._id || `${log.module}-${log.createdAt}`}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>{actorName(log)}</td>
                    <td>{log.actorRole || "-"}</td>
                    <td><span className={`audit-action action-${log.action}`}>{log.action}</span></td>
                    <td>{log.module || "-"}</td>
                    <td>{metadataSummary(log.metadata)}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan="6">No audit logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="chart-card audit-timeline-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Timeline</span>
              <h3>Recent</h3>
            </div>
            <History size={20} />
          </div>
          <div className="audit-timeline">
            {filteredLogs.slice(0, 8).map((log) => (
              <div className="audit-timeline-item" key={`timeline-${log._id || log.createdAt}`}>
                <span />
                <div>
                  <strong>{log.action} in {log.module}</strong>
                  <small>{actorName(log)} - {formatDate(log.createdAt)}</small>
                </div>
              </div>
            ))}
            {filteredLogs.length === 0 && <div className="empty-state">No recent activity.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}

function actorName(log) {
  if (log.actor && typeof log.actor === "object") {
    return log.actor.name || log.actor.username || log.actor.email || "System";
  }
  return "System";
}

function metadataSummary(metadata) {
  if (!metadata || typeof metadata !== "object") return "-";
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!entries.length) return "-";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default AuditLogPage;
