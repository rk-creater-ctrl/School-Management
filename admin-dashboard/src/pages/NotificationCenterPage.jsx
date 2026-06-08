import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, CircleDollarSign, Megaphone, Trash2, ShieldAlert } from "lucide-react";
import { classNoticesAPI, erpAPI, feesAPI } from "../api";
import { formatCurrency } from "../utils/feeReports";
import { requireSuperadminPassword } from "../utils/superadminGuard";

const tabs = ["all", "unread", "notices", "fees", "system"];
const readKey = "erp_read_notifications";
const clearedKey = "erp_cleared_notifications";
const notificationPollMs = 15000;

function NotificationCenterPage() {
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState(() => readStoredIds());
  const [clearedIds, setClearedIds] = useState(() => readStoredIds(clearedKey));
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Loading notifications...");

  useEffect(() => {
    let active = true;

    async function loadNotifications(silent = false) {
      try {
        const [analyticsRes, noticeRes, feeRes] = await Promise.all([
          erpAPI.analytics().catch(() => ({ data: {} })),
          classNoticesAPI.getAll().catch(() => ({ data: [] })),
          feesAPI.getAll().catch(() => ({ data: [] })),
        ]);

        if (!active) return;
        setItems([
          ...buildNoticeItems(noticeRes.data || []),
          ...buildFeeItems(feeRes.data || []),
          ...buildSystemItems(analyticsRes.data || {}),
        ]);
        setStatus((current) =>
          silent && !["Loading notifications...", "Notifications unavailable."].includes(current)
            ? current
            : ""
        );
      } catch {
        if (active && !silent) setStatus("Notifications unavailable.");
      }
    }

    loadNotifications();
    const timer = window.setInterval(() => loadNotifications(true), notificationPollMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (clearedIds.includes(item.id)) return false;
        const isUnread = !readIds.includes(item.id);
        const matchesTab =
          activeTab === "all" ||
          (activeTab === "unread" && isUnread) ||
          item.type === activeTab;
        const searchable = `${item.title} ${item.message} ${item.scope}`.toLowerCase();
        return matchesTab && searchable.includes(query.toLowerCase());
      }),
    [activeTab, clearedIds, items, query, readIds]
  );

  function markAllRead() {
    const nextIds = Array.from(new Set([...readIds, ...filteredItems.map((item) => item.id)]));
    setReadIds(nextIds);
    localStorage.setItem(readKey, JSON.stringify(nextIds));
  }

  function markRead(id) {
    const nextIds = Array.from(new Set([...readIds, id]));
    setReadIds(nextIds);
    localStorage.setItem(readKey, JSON.stringify(nextIds));
  }

  function toggleSelected(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredItems.map((item) => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  }

  async function clearSelected() {
    if (selectedIds.length === 0) {
      setStatus("Select notifications to clear.");
      return;
    }
    const allowed = await requireSuperadminPassword("clear selected notifications");
    if (!allowed) return;

    const nextIds = Array.from(new Set([...clearedIds, ...selectedIds]));
    setClearedIds(nextIds);
    setSelectedIds([]);
    localStorage.setItem(clearedKey, JSON.stringify(nextIds));
    setStatus("Selected notifications cleared.");
  }

  async function clearAll() {
    if (items.length === 0) return;
    const allowed = await requireSuperadminPassword("clear all notifications");
    if (!allowed) return;

    const nextIds = Array.from(new Set([...clearedIds, ...items.map((item) => item.id)]));
    setClearedIds(nextIds);
    setSelectedIds([]);
    localStorage.setItem(clearedKey, JSON.stringify(nextIds));
    setStatus("All notifications cleared.");
  }

  const activeItems = items.filter((item) => !clearedIds.includes(item.id));
  const unreadCount = activeItems.filter((item) => !readIds.includes(item.id)).length;
  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));

  return (
    <div className="notification-center-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Notifications</span>
          <h2>Notification Center</h2>
        </div>
        <div className="module-actions">
          <button className="secondary-button" onClick={markAllRead}><CheckCheck size={18} /> Mark All Read</button>
          <button className="secondary-button" onClick={clearSelected}><Trash2 size={18} /> Clear Selected</button>
          <button className="secondary-button danger-button" onClick={clearAll}><Trash2 size={18} /> Clear All</button>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="notification-toolbar">
        <div className="report-tabs">
          {tabs.map((tab) => (
            <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)}>
              {tab === "unread" ? `Unread (${unreadCount})` : tab}
            </button>
          ))}
        </div>
        <div className="search-box">
          <Bell size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notifications" />
        </div>
      </section>

      <section className="notification-selectbar">
        <label className="toggle-row">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
          <span>Select visible</span>
        </label>
        <strong>{selectedIds.length} selected</strong>
      </section>

      <section className="notification-list">
        {filteredItems.map((item) => {
          const isUnread = !readIds.includes(item.id);
          return (
            <article className={isUnread ? "notification-card unread" : "notification-card"} key={item.id}>
              <label className="notification-check" aria-label={`Select ${item.title}`}>
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} />
              </label>
              <div className="notification-icon">{item.icon}</div>
              <div>
                <span>{item.scope}</span>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <small>{item.date}</small>
              </div>
              {isUnread && <button className="ghost-button" onClick={() => markRead(item.id)}>Read</button>}
            </article>
          );
        })}
        {filteredItems.length === 0 && <div className="empty-state">No notifications.</div>}
      </section>
    </div>
  );
}

function buildNoticeItems(notices) {
  return notices.map((notice) => ({
    id: `notice-${notice._id || notice.title}`,
    type: "notices",
    scope: notice.className === "__GLOBAL__" ? "All classes" : notice.className || "Class",
    title: notice.title,
    message: notice.message,
    date: notice.createdAt ? new Date(notice.createdAt).toLocaleString("en-IN") : "Notice",
    icon: <Megaphone size={18} />,
  }));
}

function buildFeeItems(fees) {
  return fees
    .filter((fee) => Number(fee.dueAmount || 0) > 0)
    .slice(0, 40)
    .map((fee) => ({
      id: `fee-${fee._id}`,
      type: "fees",
      scope: fee.className || "Fees",
      title: `${fee.studentName || "Student"} fee due`,
      message: `${formatCurrency(fee.dueAmount)} pending for ${fee.academicYear}.`,
      date: fee.updatedAt ? new Date(fee.updatedAt).toLocaleString("en-IN") : "Fee due",
      icon: <CircleDollarSign size={18} />,
    }));
}

function buildSystemItems(analytics) {
  const activities = analytics.activities || [];
  const notifications = analytics.notifications || [];
  return [...notifications, ...activities].slice(0, 30).map((item, index) => ({
    id: `system-${item._id || item.title || item.action || index}`,
    type: "system",
    scope: item.module || "System",
    title: item.title || item.action || "System update",
    message: item.message || (item.module ? `Activity recorded in ${item.module}.` : "Activity recorded."),
    date: item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "System",
    icon: <ShieldAlert size={18} />,
  }));
}

function readStoredIds(key = readKey) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export default NotificationCenterPage;
