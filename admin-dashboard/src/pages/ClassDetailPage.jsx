// src/pages/ClassDetailPage.jsx
//* eslint-disable react-hooks/immutability */
import { useEffect, useState } from "react";
import { homeworkAPI, classNoticesAPI } from "../api";
import { useParams, Link } from "react-router-dom";
import { canUseRole, getStoredUser } from "../permissions";

function ClassDetailPage() {
  // Treat param as className, e.g. "6A"
  const { id } = useParams();
  const className = decodeURIComponent(id || "");
  const currentUser = getStoredUser();
  const canManageHomework = canUseRole(["superadmin"], currentUser);
  const canManageNotices = canUseRole(["superadmin", "admin"], currentUser);

  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [homework, setHomework] = useState([]);
  const [loadingHw, setLoadingHw] = useState(true);
  const [errorHw, setErrorHw] = useState("");

  const [notices, setNotices] = useState([]);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [errorNotices, setErrorNotices] = useState("");

  const [hwForm, setHwForm] = useState({
    id: null,
    subject: "",
    homeworkText: "",
  });
  const [savingHw, setSavingHw] = useState(false);
  const [showHwForm, setShowHwForm] = useState(false);

  const [noticeForm, setNoticeForm] = useState({
    id: null,
    title: "",
    message: "",
    startDate: "",
    expiryDate: "",
  });
  const [savingNotice, setSavingNotice] = useState(false);
  const [showNoticeForm, setShowNoticeForm] = useState(false);

  useEffect(() => {
    if (className) {
      loadHomework();
      loadNotices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, date]);

  async function loadHomework() {
    try {
      setLoadingHw(true);
      setErrorHw("");
      const res = await homeworkAPI.list(className, date);
      setHomework(res.data || []);
    } catch (err) {
      console.error(err);
      setErrorHw(
        err.response?.data?.error || "Failed to load homework. Try again."
      );
    } finally {
      setLoadingHw(false);
    }
  }

  async function loadNotices() {
    try {
      setLoadingNotices(true);
      setErrorNotices("");
      const res = await classNoticesAPI.list(className, date);
      setNotices(res.data || []);
    } catch (err) {
      console.error(err);
      setErrorNotices(
        err.response?.data?.error || "Failed to load notices. Try again."
      );
    } finally {
      setLoadingNotices(false);
    }
  }

  function handleHwFormChange(e) {
    const { name, value } = e.target;
    setHwForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleNoticeFormChange(e) {
    const { name, value } = e.target;
    setNoticeForm((prev) => ({ ...prev, [name]: value }));
  }

  function startCreateHw() {
    setHwForm({
      id: null,
      subject: "",
      homeworkText: "",
    });
    setShowHwForm(true);
  }

  function startEditHw(item) {
    setHwForm({
      id: item._id,
      subject: item.subject,
      homeworkText: item.homeworkText,
    });
    setShowHwForm(true);
  }

  async function handleHwSubmit(e) {
    e.preventDefault();
    try {
      setSavingHw(true);
      if (!hwForm.subject || !hwForm.homeworkText) {
        alert("Subject and homework are required");
        setSavingHw(false);
        return;
      }

      if (hwForm.id) {
        await homeworkAPI.update(hwForm.id, {
          subject: hwForm.subject,
          homeworkText: hwForm.homeworkText,
          date,
          className,
        });
      } else {
        await homeworkAPI.create({
          className,
          date,
          subject: hwForm.subject,
          homeworkText: hwForm.homeworkText,
        });
      }

      setHwForm({ id: null, subject: "", homeworkText: "" });
      setShowHwForm(false);
      await loadHomework();
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.error || "Failed to save homework. Try again."
      );
    } finally {
      setSavingHw(false);
    }
  }

  async function handleHwDelete(hwId) {
    const ok = window.confirm("Delete this homework?");
    if (!ok) return;
    try {
      await homeworkAPI.remove(hwId);
      setHomework((prev) => prev.filter((h) => h._id !== hwId));
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.error || "Failed to delete homework. Try again."
      );
    }
  }

  function startCreateNotice() {
    setNoticeForm({
      id: null,
      title: "",
      message: "",
      startDate: date,
      expiryDate: date,
    });
    setShowNoticeForm(true);
  }

  function startEditNotice(item) {
    setNoticeForm({
      id: item._id,
      title: item.title,
      message: item.message,
      startDate: item.startDate?.slice(0, 10) || date,
      expiryDate: item.expiryDate?.slice(0, 10) || date,
    });
    setShowNoticeForm(true);
  }

  async function handleNoticeSubmit(e) {
    e.preventDefault();
    try {
      setSavingNotice(true);
      if (
        !noticeForm.title ||
        !noticeForm.message ||
        !noticeForm.startDate ||
        !noticeForm.expiryDate
      ) {
        alert("All notice fields are required");
        setSavingNotice(false);
        return;
      }

      if (noticeForm.id) {
        await classNoticesAPI.update(noticeForm.id, {
          title: noticeForm.title,
          message: noticeForm.message,
          startDate: noticeForm.startDate,
          expiryDate: noticeForm.expiryDate,
          className,
        });
      } else {
        await classNoticesAPI.create({
          className,
          title: noticeForm.title,
          message: noticeForm.message,
          startDate: noticeForm.startDate,
          expiryDate: noticeForm.expiryDate,
        });
      }

      setNoticeForm({
        id: null,
        title: "",
        message: "",
        startDate: "",
        expiryDate: "",
      });
      setShowNoticeForm(false);
      await loadNotices();
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.error || "Failed to save notice. Try again."
      );
    } finally {
      setSavingNotice(false);
    }
  }

  async function handleNoticeDelete(noticeId) {
    const ok = window.confirm("Delete this notice?");
    if (!ok) return;
    try {
      await classNoticesAPI.remove(noticeId);
      setNotices((prev) => prev.filter((n) => n._id !== noticeId));
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.error || "Failed to delete notice. Try again."
      );
    }
  }

  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <Link to="/classes" style={{ fontSize: "13px", color: "#2563eb" }}>
          ← Back to classes
        </Link>
      </div>

      <header style={{ marginBottom: "16px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
          {className} Homework & Notices
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          Review daily homework and notices for this class.
        </p>
      </header>

      {/* date filter */}
      <section style={{ marginBottom: "16px" }}>
        <label
          style={{
            display: "inline-flex",
            flexDirection: "column",
            fontSize: "13px",
          }}
        >
          <span style={{ marginBottom: "4px", color: "#4b5563" }}>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
            }}
          />
        </label>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Homework card */}
        <section
          style={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            background: "white",
            padding: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Homework
            </h2>
            {canManageHomework && (
              <button
                type="button"
                onClick={startCreateHw}
                style={{
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                + Add
              </button>
            )}
          </div>

          {errorHw && (
            <div
              style={{
                padding: "8px 10px",
                marginBottom: "8px",
                borderRadius: "8px",
                background: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                fontSize: "12px",
              }}
            >
              {errorHw}
            </div>
          )}

          {loadingHw ? (
            <div style={{ padding: "16px", textAlign: "center" }}>
              Loading...
            </div>
          ) : (
            <>
              {/* list */}
              {homework.length === 0 ? (
                <div
                  style={{
                    padding: "12px 0",
                    color: "#6b7280",
                    fontSize: "13px",
                  }}
                >
                  No homework added for this date.
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 12px",
                  }}
                >
                  {homework.map((h) => (
                    <li
                      key={h._id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        padding: "8px 0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {h.subject}
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "#4b5563",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {h.homeworkText}
                          </div>
                        </div>
                        {canManageHomework && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => startEditHw(h)}
                              style={{
                                border: "none",
                                background: "#e5e7eb",
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHwDelete(h._id)}
                              style={{
                                border: "none",
                                background: "#fee2e2",
                                color: "#b91c1c",
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* form */}
              {canManageHomework && showHwForm && (
                <form onSubmit={handleHwSubmit}>
                  <div
                    style={{
                      marginTop: "8px",
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <input
                        type="text"
                        name="subject"
                        value={hwForm.subject}
                        onChange={handleHwFormChange}
                        placeholder="Subject"
                        style={inputStyle}
                      />
                      <textarea
                        name="homeworkText"
                        value={hwForm.homeworkText}
                        onChange={handleHwFormChange}
                        placeholder="Homework"
                        style={{
                          ...inputStyle,
                          minHeight: "60px",
                          resize: "vertical",
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingHw}
                      style={{
                        background: savingHw ? "#93c5fd" : "#2563eb",
                        border: "none",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {savingHw
                        ? "Saving..."
                        : hwForm.id
                        ? "Save changes"
                        : "Add homework"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>

        {/* Notices card */}
        <section
          style={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            background: "white",
            padding: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Notices
            </h2>
            {canManageNotices && (
              <button
                type="button"
                onClick={startCreateNotice}
                style={{
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                + Add
              </button>
            )}
          </div>

          {errorNotices && (
            <div
              style={{
                padding: "8px 10px",
                marginBottom: "8px",
                borderRadius: "8px",
                background: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                fontSize: "12px",
              }}
            >
              {errorNotices}
            </div>
          )}

          {loadingNotices ? (
            <div style={{ padding: "16px", textAlign: "center" }}>
              Loading...
            </div>
          ) : (
            <>
              {notices.length === 0 ? (
                <div
                  style={{
                    padding: "12px 0",
                    color: "#6b7280",
                    fontSize: "13px",
                  }}
                >
                  No active notices for this date.
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 12px",
                  }}
                >
                  {notices.map((n) => (
                    <li
                      key={n._id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        padding: "8px 0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {n.title}
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "#4b5563",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {n.message}
                          </div>
                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "12px",
                              color: "#6b7280",
                            }}
                          >
                            Visible: {n.startDate?.slice(0, 10)} -{" "}
                            {n.expiryDate?.slice(0, 10)}
                          </div>
                        </div>
                        {canManageNotices && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => startEditNotice(n)}
                              style={{
                                border: "none",
                                background: "#e5e7eb",
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleNoticeDelete(n._id)}
                              style={{
                                border: "none",
                                background: "#fee2e2",
                                color: "#b91c1c",
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {canManageNotices && showNoticeForm && (
                <form onSubmit={handleNoticeSubmit}>
                  <div
                    style={{
                      marginTop: "8px",
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <input
                        type="text"
                        name="title"
                        value={noticeForm.title}
                        onChange={handleNoticeFormChange}
                        placeholder="Notice title"
                        style={inputStyle}
                      />
                      <textarea
                        name="message"
                        value={noticeForm.message}
                        onChange={handleNoticeFormChange}
                        placeholder="Notice message"
                        style={{
                          ...inputStyle,
                          minHeight: "60px",
                          resize: "vertical",
                        }}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: "8px",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            fontSize: "12px",
                          }}
                        >
                          <span
                            style={{
                              marginBottom: "2px",
                              color: "#4b5563",
                            }}
                          >
                            Start date
                          </span>
                          <input
                            type="date"
                            name="startDate"
                            value={noticeForm.startDate}
                            onChange={handleNoticeFormChange}
                            style={inputStyle}
                          />
                        </label>
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            fontSize: "12px",
                          }}
                        >
                          <span
                            style={{
                              marginBottom: "2px",
                              color: "#4b5563",
                            }}
                          >
                            Expiry date
                          </span>
                          <input
                            type="date"
                            name="expiryDate"
                            value={noticeForm.expiryDate}
                            onChange={handleNoticeFormChange}
                            style={inputStyle}
                          />
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingNotice}
                      style={{
                        background: savingNotice ? "#93c5fd" : "#2563eb",
                        border: "none",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {savingNotice
                        ? "Saving..."
                        : noticeForm.id
                        ? "Save changes"
                        : "Add notice"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

const inputStyle = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
  width: "100%",
};

export default ClassDetailPage;
