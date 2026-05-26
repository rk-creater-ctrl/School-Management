import { createElement, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  Bell,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Home,
  Inbox,
  Layers,
  ListChecks,
  Search,
  NotebookTabs,
  Plus,
  Save,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { studentsAPI, teacherAPI } from "../api";

const days = ["Daily", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const reviewLabels = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
  needs_correction: "Needs correction",
};

const emptyProfile = {
  employeeCode: "",
  designation: "",
  department: "",
  qualification: "",
  experienceYears: "",
  alternatePhone: "",
  address: "",
  about: "",
  subjects: [],
  assignments: [],
  schedule: [],
  user: {},
};

const emptyWork = {
  period: "",
  periodStatus: "pending",
  lessonPlan: "",
  reviewStatus: "draft",
  homeworkText: "",
  chapter: "",
  taughtToday: "",
  syllabusStatus: "",
  copySubmittedStudentIds: [],
  examCopyTakenStudentIds: [],
  copyNaStudentRecords: [],
  notes: "",
};

const teacherNav = [
  { to: "/teacher", label: "Overview", icon: Home, end: true },
  { to: "/teacher/schedule", label: "Schedule", icon: CalendarCheck },
  { to: "/teacher/plans", label: "Lesson Plans", icon: NotebookTabs },
  { to: "/teacher/homework", label: "Homework", icon: FileText },
  { to: "/teacher/syllabus", label: "Syllabus", icon: Layers },
  { to: "/teacher/copies", label: "Copy Records", icon: ClipboardCheck },
  { to: "/teacher/attendance", label: "Attendance", icon: CheckCircle2 },
  { to: "/teacher/inbox", label: "Inbox", icon: Inbox },
  { to: "/teacher/reports", label: "Reports", icon: ListChecks },
  { to: "/teacher/profile", label: "Profile", icon: UserRound },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function monthEndIso() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function dayName(dateValue = todayIso()) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

function normalizeId(value) {
  return String(value?._id || value || "");
}

function normalizeRecord(record) {
  return record
    ? {
        period: record.period || "",
        periodStatus: record.periodStatus || "pending",
        lessonPlan: record.lessonPlan || "",
        reviewStatus: record.reviewStatus || "draft",
        homeworkText: record.homeworkText || "",
        chapter: record.chapter || "",
        taughtToday: record.taughtToday || "",
        syllabusStatus: record.syllabusStatus || "",
        copySubmittedStudentIds: (record.copySubmittedStudentIds || []).map(normalizeId),
        examCopyTakenStudentIds: (record.examCopyTakenStudentIds || []).map(normalizeId),
        copyNaStudentRecords: normalizeCopyNaRecords(record.copyNaStudentRecords),
        notes: record.notes || "",
      }
    : emptyWork;
}

function normalizeCopyNaRecords(records) {
  if (!Array.isArray(records)) return [];
  return records
    .map((item) => ({
      id: item.id || item._id || `${item.studentName || item.name || ""}-${item.admissionNo || ""}-${item.rollNo || ""}`,
      studentName: item.studentName || item.name || "",
      className: item.className || item.admissionNo || "",
      rollNo: item.rollNo || "",
      note: item.note || "",
    }))
    .filter((item) => item.studentName || item.className || item.rollNo);
}

function assignedPairs(profile) {
  const unique = new Map();
  [...(profile.assignments || []), ...(profile.schedule || [])].forEach((item) => {
    if (item.className && item.subject) {
      unique.set(`${item.className}::${item.subject}`, {
        className: item.className,
        subject: item.subject,
      });
    }
  });
  return [...unique.values()];
}

function TeacherWorkspacePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [classes, setClasses] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const pairs = useMemo(() => assignedPairs(profile), [profile]);
  const classOptions = useMemo(() => {
    const fromAssignments = pairs.map((item) => item.className);
    return [...new Set([...fromAssignments, ...classes].filter(Boolean))].sort();
  }, [classes, pairs]);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const [profileRes, classRes] = await Promise.all([
          teacherAPI.getProfile(),
          studentsAPI.getClasses().catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        setProfile({ ...emptyProfile, ...(profileRes.data || {}) });
        setClasses(classRes.data || []);
      } catch (error) {
        if (active) setStatus(error.response?.data?.error || "Unable to load teacher workspace.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWorkspace();
    return () => {
      active = false;
    };
  }, []);

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function updateAssignment(index, field, value) {
    setProfile((current) => ({
      ...current,
      assignments: (current.assignments || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addAssignment() {
    setProfile((current) => ({
      ...current,
      assignments: [...(current.assignments || []), { className: classOptions[0] || "", subject: "" }],
    }));
  }

  function removeAssignment(index) {
    setProfile((current) => ({
      ...current,
      assignments: (current.assignments || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateSchedule(index, field, value) {
    setProfile((current) => ({
      ...current,
      schedule: (current.schedule || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addSchedule() {
    setProfile((current) => ({
      ...current,
      schedule: [
        ...(current.schedule || []),
        {
          day: "Daily",
          period: `${(current.schedule?.length || 0) + 1}`,
          className: classOptions[0] || "",
          subject: "",
          startTime: "",
          endTime: "",
          note: "",
        },
      ],
    }));
  }

  function removeSchedule(index) {
    setProfile((current) => ({
      ...current,
      schedule: (current.schedule || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveProfile(event) {
    event?.preventDefault();
    try {
      const saved = await teacherAPI.saveProfile(profile);
      setProfile({ ...emptyProfile, ...(saved.data || {}) });
      setStatus("Teacher details saved.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save teacher details.");
    }
  }

  const shared = {
    profile,
    classes,
    pairs,
    classOptions,
    setStatus,
    updateProfile,
    updateAssignment,
    addAssignment,
    removeAssignment,
    updateSchedule,
    addSchedule,
    removeSchedule,
    saveProfile,
  };

  if (loading) return <div className="empty-state">Loading teacher workspace.</div>;

  return (
    <div className="teacher-page">
      <section className="module-hero teacher-portal-hero">
        <div>
          <span className="eyebrow">Teacher Desk</span>
          <h2>{profile.user?.name || "Teacher Workspace"}</h2>
          <p>{profile.user?.email || "Teacher account"}</p>
        </div>
        <div className="teacher-hero-metrics">
          <strong>{pairs.length}</strong>
          <span>Assigned class subjects</span>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <section className="teacher-portal-shell">
        <aside className="teacher-portal-nav">
          {teacherNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="teacher-portal-link">
              <item.icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </aside>

        <div className="teacher-portal-content">
          <Routes>
            <Route index element={<TeacherHome {...shared} />} />
            <Route path="schedule" element={<SchedulePage {...shared} />} />
            <Route path="plans" element={<LessonPlansPage {...shared} />} />
            <Route path="homework" element={<HomeworkPage {...shared} />} />
            <Route path="syllabus" element={<SyllabusPage {...shared} />} />
            <Route path="copies" element={<CopyRecordsPage {...shared} />} />
            <Route path="attendance" element={<TeacherAttendancePage {...shared} />} />
            <Route path="inbox" element={<InboxPage setStatus={setStatus} />} />
            <Route path="reports" element={<ReportsPage setStatus={setStatus} />} />
            <Route path="profile" element={<ProfileAssignmentsPage {...shared} />} />
            <Route path="*" element={<Navigate to="/teacher" replace />} />
          </Routes>
        </div>
      </section>
    </div>
  );
}

function TeacherHome({ profile, pairs }) {
  const today = todayIso();
  const currentDay = dayName(today);
  const todayPeriods = (profile.schedule || []).filter((item) => item.day === "Daily" || item.day === currentDay);

  return (
    <div className="teacher-section-grid">
      <article className="teacher-dashboard-card hero-card">
        <span className="eyebrow">Today</span>
        <h3>{currentDay}</h3>
        <p>{todayPeriods.length || 0} periods scheduled for today.</p>
        <Link className="primary-button" to="/teacher/schedule">
          <CalendarCheck size={18} /> Open Schedule
        </Link>
      </article>

      <MetricCard label="Class subjects" value={pairs.length} />
      <MetricCard label="Periods today" value={todayPeriods.length} />
      <MetricCard label="Subjects" value={(profile.subjects || []).length} />

      <div className="teacher-tile-grid">
        <TeacherTile to="/teacher/plans" icon={NotebookTabs} title="Lesson Plans" text="Submit plans and track review status." />
        <TeacherTile to="/teacher/homework" icon={FileText} title="Homework" text="Post daily subject homework and review history." />
        <TeacherTile to="/teacher/syllabus" icon={Layers} title="Syllabus" text="Track chapters and what was taught today." />
        <TeacherTile to="/teacher/copies" icon={ClipboardCheck} title="Copy Records" text="Mark copy submission and exam copy status." />
        <TeacherTile to="/teacher/inbox" icon={Inbox} title="Inbox" text="Read admin and principal announcements." />
        <TeacherTile to="/teacher/reports" icon={ListChecks} title="Monthly Report" text="Review periods, homework, plans, and syllabus." />
      </div>
    </div>
  );
}

function SchedulePage({ profile, classOptions, updateSchedule, addSchedule, removeSchedule, saveProfile, setStatus }) {
  const [date, setDate] = useState(todayIso);
  const [records, setRecords] = useState([]);
  const [savingKey, setSavingKey] = useState("");
  const currentDay = dayName(date);
  const todayPeriods = (profile.schedule || []).filter((item) => item.day === "Daily" || item.day === currentDay);

  useEffect(() => {
    let active = true;
    teacherAPI
      .getWorkRecords({ date })
      .then((res) => {
        if (active) setRecords(res.data || []);
      })
      .catch((error) => {
        if (active) setStatus(error.response?.data?.error || "Unable to load period status.");
      });
    return () => {
      active = false;
    };
  }, [date, setStatus]);

  function findRecord(item) {
    return records.find((record) => record.className === item.className && record.subject === item.subject);
  }

  async function markPeriod(item, periodStatus) {
    const key = `${item.period}-${item.className}-${item.subject}-${periodStatus}`;
    try {
      setSavingKey(key);
      await teacherAPI.saveWorkRecord({
        date,
        className: item.className,
        subject: item.subject,
        period: item.period,
        periodStatus,
      });
      const res = await teacherAPI.getWorkRecords({ date });
      setRecords(res.data || []);
      setStatus("Period status saved.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save period status.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Schedule" title="Today's Period View" />

      <article className="chart-card teacher-full-card">
        <div className="teacher-context-grid">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
        <div className="teacher-period-list">
          {todayPeriods.map((item, index) => {
            const record = findRecord(item);
            const periodStatus = record?.periodStatus || "pending";
            return (
              <div className={`teacher-period-row status-${periodStatus}`} key={`${item.day}-${item.period}-${index}`}>
                <div>
                  <strong>Period {item.period}</strong>
                  <span>{item.className} - {item.subject}</span>
                  <small>{[item.startTime, item.endTime].filter(Boolean).join(" to ") || item.note || "No time set"}</small>
                </div>
                <StatusPill value={periodStatus} />
                <div className="teacher-row-actions">
                  <button className="secondary-button" type="button" disabled={savingKey.includes(`${item.period}-${item.className}`)} onClick={() => markPeriod(item, "completed")}>Completed</button>
                  <button className="secondary-button danger-button" type="button" disabled={savingKey.includes(`${item.period}-${item.className}`)} onClick={() => markPeriod(item, "skipped")}>Skipped</button>
                </div>
              </div>
            );
          })}
          {todayPeriods.length === 0 && <div className="empty-state">No periods scheduled for {currentDay}.</div>}
        </div>
      </article>

      <ScheduleEditor
        profile={profile}
        classOptions={classOptions}
        updateSchedule={updateSchedule}
        addSchedule={addSchedule}
        removeSchedule={removeSchedule}
        saveProfile={saveProfile}
      />
    </div>
  );
}

function LessonPlansPage({ pairs, setStatus }) {
  const defaults = getDefaultPair(pairs);
  const [date, setDate] = useState(todayIso);
  const [className, setClassName] = useState(defaults.className);
  const [subject, setSubject] = useState(defaults.subject);
  const recordState = useTeacherRecord({ date, className, subject, setStatus });
  const reviewStatus = recordState.form.reviewStatus || "draft";

  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Lesson Plans" title="Plan Submission and Review" />
      <article className="chart-card teacher-full-card">
        <TeacherSelector pairs={pairs} date={date} setDate={setDate} className={className} setClassName={setClassName} subject={subject} setSubject={setSubject} />
        <div className="teacher-work-grid">
          <label className="field">
            <span>Lesson plan</span>
            <textarea rows={8} value={recordState.form.lessonPlan} onChange={(event) => recordState.update("lessonPlan", event.target.value)} />
          </label>
          <label className="field">
            <span>What was taught today</span>
            <textarea rows={8} value={recordState.form.taughtToday} onChange={(event) => recordState.update("taughtToday", event.target.value)} />
          </label>
          <label className="field">
            <span>Submission status</span>
            <select value={reviewStatus === "submitted" ? "submitted" : "draft"} onChange={(event) => recordState.update("reviewStatus", event.target.value)}>
              <option value="draft">Draft</option>
              <option value="submitted">Submit for review</option>
            </select>
          </label>
          <div className="teacher-review-box">
            <span className="eyebrow">Admin Review</span>
            <strong>{reviewLabels[reviewStatus] || "Draft"}</strong>
            <p>{recordState.record?.reviewComment || "No review comment yet."}</p>
          </div>
        </div>
        <button className="primary-button teacher-save-button" type="button" disabled={recordState.saving} onClick={() => recordState.save("Lesson plan saved.")}>
          <Send size={18} /> {recordState.saving ? "Saving" : "Save Lesson Plan"}
        </button>
      </article>
    </div>
  );
}

function HomeworkPage({ pairs, setStatus }) {
  const defaults = getDefaultPair(pairs);
  const [date, setDate] = useState(todayIso);
  const [className, setClassName] = useState(defaults.className);
  const [subject, setSubject] = useState(defaults.subject);
  const [history, setHistory] = useState([]);
  const recordState = useTeacherRecord({ date, className, subject, setStatus });

  useEffect(() => {
    if (!className || !subject) return undefined;
    let active = true;
    teacherAPI
      .getWorkRecords({ className, subject })
      .then((res) => {
        if (active) setHistory((res.data || []).filter((item) => item.homeworkText));
      })
      .catch((error) => {
        if (active) setStatus(error.response?.data?.error || "Unable to load homework history.");
      });
    return () => {
      active = false;
    };
  }, [className, subject, setStatus]);

  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Homework" title="Daily Homework and History" />
      <article className="chart-card teacher-full-card">
        <TeacherSelector pairs={pairs} date={date} setDate={setDate} className={className} setClassName={setClassName} subject={subject} setSubject={setSubject} />
        <label className="field">
          <span>Daily homework</span>
          <textarea rows={5} value={recordState.form.homeworkText} onChange={(event) => recordState.update("homeworkText", event.target.value)} />
        </label>
        <button className="primary-button teacher-save-button" type="button" disabled={recordState.saving} onClick={() => recordState.save("Homework published to class homework board.")}>
          <FileText size={18} /> {recordState.saving ? "Publishing" : "Publish Homework"}
        </button>
      </article>

      <article className="chart-card teacher-full-card">
        <PortalHeading eyebrow="History" title="Previous Homework" compact />
        <div className="teacher-history-list">
          {history.slice(0, 10).map((item) => (
            <div className="teacher-history-item" key={item._id}>
              <strong>{formatDate(item.date)}</strong>
              <span>{item.homeworkText}</span>
            </div>
          ))}
          {history.length === 0 && <div className="empty-state">No homework history for this class and subject.</div>}
        </div>
      </article>
    </div>
  );
}

function SyllabusPage({ pairs, setStatus }) {
  const defaults = getDefaultPair(pairs);
  const [date, setDate] = useState(todayIso);
  const [className, setClassName] = useState(defaults.className);
  const [subject, setSubject] = useState(defaults.subject);
  const [records, setRecords] = useState([]);
  const recordState = useTeacherRecord({ date, className, subject, setStatus });

  useEffect(() => {
    if (!className || !subject) return undefined;
    let active = true;
    teacherAPI
      .getWorkRecords({ className, subject })
      .then((res) => {
        if (active) setRecords(res.data || []);
      })
      .catch((error) => {
        if (active) setStatus(error.response?.data?.error || "Unable to load syllabus progress.");
      });
    return () => {
      active = false;
    };
  }, [className, subject, setStatus]);

  const chapterRecords = records.filter((item) => item.chapter);
  const completed = chapterRecords.filter((item) => ["Completed", "Revision"].includes(item.syllabusStatus)).length;
  const progress = chapterRecords.length ? Math.round((completed / chapterRecords.length) * 100) : 0;

  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Syllabus" title="Chapter Progress" />
      <article className="chart-card teacher-full-card">
        <div className="teacher-progress-header">
          <div>
            <strong>{progress}%</strong>
            <span>chapter records completed or in revision</span>
          </div>
          <div className="teacher-progress-line"><i style={{ width: `${progress}%` }} /></div>
        </div>
        <TeacherSelector pairs={pairs} date={date} setDate={setDate} className={className} setClassName={setClassName} subject={subject} setSubject={setSubject} />
        <div className="teacher-work-grid">
          <Field label="Chapter" value={recordState.form.chapter} onChange={(value) => recordState.update("chapter", value)} />
          <Field label="What was taught today" value={recordState.form.taughtToday} onChange={(value) => recordState.update("taughtToday", value)} />
          <label className="field">
            <span>Syllabus status</span>
            <select value={recordState.form.syllabusStatus} onChange={(event) => recordState.update("syllabusStatus", event.target.value)}>
              <option value="">Select status</option>
              <option>Started</option>
              <option>In progress</option>
              <option>Completed</option>
              <option>Revision</option>
            </select>
          </label>
          <Field label="Notes" value={recordState.form.notes} onChange={(value) => recordState.update("notes", value)} />
        </div>
        <button className="primary-button teacher-save-button" type="button" disabled={recordState.saving} onClick={() => recordState.save("Syllabus progress saved.")}>
          <Save size={18} /> {recordState.saving ? "Saving" : "Save Syllabus Progress"}
        </button>
      </article>

      <article className="chart-card teacher-full-card">
        <PortalHeading eyebrow="Timeline" title="Chapter Records" compact />
        <div className="teacher-history-list">
          {chapterRecords.slice(0, 12).map((item) => (
            <div className="teacher-history-item" key={item._id}>
              <strong>{item.chapter}</strong>
              <span>{formatDate(item.date)} - {item.syllabusStatus || "Recorded"} - {item.taughtToday || "No note"}</span>
            </div>
          ))}
          {chapterRecords.length === 0 && <div className="empty-state">No syllabus records yet.</div>}
        </div>
      </article>
    </div>
  );
}

function CopyRecordsPage({ pairs, profile, classOptions, setStatus }) {
  const defaults = getDefaultPair(pairs);
  const initialClassName = defaults.className || classOptions[0] || "";
  const initialSubject = defaults.subject || profile.subjects?.[0] || "General";
  const [date, setDate] = useState(todayIso);
  const [className, setClassName] = useState(initialClassName);
  const [subject, setSubject] = useState(initialSubject);
  const [students, setStudents] = useState([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [naStudent, setNaStudent] = useState({ studentName: "", className: initialClassName, rollNo: "", note: "" });
  const recordState = useTeacherRecord({ date, className, subject, setStatus });
  const copySubjectOptions = useMemo(() => {
    const assigned = pairs
      .filter((item) => item.className === className)
      .map((item) => item.subject);
    return [...new Set([...assigned, ...(profile.subjects || []), subject].filter(Boolean))].sort();
  }, [className, pairs, profile.subjects, subject]);

  useEffect(() => {
    if (!className) return undefined;
    let active = true;
    teacherAPI
      .getStudents(className)
      .then((res) => {
        if (active) setStudents(res.data || []);
      })
      .catch((error) => {
        if (!active) return;
        setStudents([]);
        setStatus(error.response?.data?.error || "Unable to load class students.");
      });
    return () => {
      active = false;
    };
  }, [className, setStatus]);

  const submittedIds = recordState.form.copySubmittedStudentIds || [];
  const examIds = recordState.form.examCopyTakenStudentIds || [];
  const naRecords = recordState.form.copyNaStudentRecords || [];
  const visibleStudents = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      [student.name, student.rollNo, student.className, student.fatherName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [studentQuery, students]);
  const visibleStudentIds = useMemo(() => visibleStudents.map(normalizeId).filter(Boolean), [visibleStudents]);
  const pendingCount = Math.max(students.length - submittedIds.length, 0);
  const submittedPercent = students.length ? Math.round((submittedIds.length / students.length) * 100) : 0;
  const examPercent = students.length ? Math.round((examIds.length / students.length) * 100) : 0;

  function toggleStudent(field, studentId) {
    recordState.setForm((current) => {
      const values = current[field] || [];
      return {
        ...current,
        [field]: values.includes(studentId)
          ? values.filter((id) => id !== studentId)
          : [...values, studentId],
      };
    });
  }

  function chooseClass(nextClass) {
    setClassName(nextClass);
    const nextSubject =
      pairs.find((item) => item.className === nextClass)?.subject ||
      profile.subjects?.[0] ||
      subject ||
      "General";
    setSubject(nextSubject);
  }

  function setStudentsForField(field, studentIds, checked) {
    recordState.setForm((current) => {
      const currentIds = current[field] || [];
      const nextIds = checked
        ? [...new Set([...currentIds, ...studentIds])]
        : currentIds.filter((id) => !studentIds.includes(id));
      return { ...current, [field]: nextIds };
    });
  }

  function markAllVisible() {
    setStudentsForField("copySubmittedStudentIds", visibleStudentIds, true);
  }

  function clearAllVisible() {
    setStudentsForField("copySubmittedStudentIds", visibleStudentIds, false);
    setStudentsForField("examCopyTakenStudentIds", visibleStudentIds, false);
  }

  function updateNaStudent(field, value) {
    setNaStudent((current) => ({ ...current, [field]: value }));
  }

  function addNaStudent(event) {
    event.preventDefault();
    const nextRecord = {
      id: `na-${Date.now()}`,
      studentName: naStudent.studentName.trim(),
      className: (naStudent.className || className).trim(),
      rollNo: naStudent.rollNo.trim(),
      note: naStudent.note.trim() || "Manual copy record",
    };

    if (!nextRecord.studentName && !nextRecord.className && !nextRecord.rollNo) {
      setStatus("Enter student name, class, or roll number.");
      return;
    }

    recordState.setForm((current) => ({
      ...current,
      copyNaStudentRecords: [...(current.copyNaStudentRecords || []), nextRecord],
    }));
    setNaStudent({ studentName: "", className, rollNo: "", note: "" });
    setStatus("Additional student record added. Save copy records to store it.");
  }

  function removeNaStudent(recordId) {
    recordState.setForm((current) => ({
      ...current,
      copyNaStudentRecords: (current.copyNaStudentRecords || []).filter((item) => item.id !== recordId && item._id !== recordId),
    }));
  }

  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Copy Records" title="Class-wise Copy Checking" />
      <article className="chart-card teacher-full-card">
        <div className="teacher-context-grid">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Class</span>
            <select value={className} onChange={(event) => chooseClass(event.target.value)}>
              <option value="">Select class</option>
              {classOptions.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Subject</span>
            <select value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="">Select subject</option>
              {copySubjectOptions.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>
        {classOptions.length > 0 && (
          <div className="teacher-class-chip-row">
            {classOptions.map((name) => (
              <button className={name === className ? "chip active" : "chip"} type="button" key={name} onClick={() => chooseClass(name)}>
                {name}
              </button>
            ))}
          </div>
        )}
        <div className="teacher-copy-summary">
          <MetricCard label="Students" value={students.length} />
          <MetricCard label="Copies submitted" value={`${submittedIds.length}/${students.length}`} />
          <MetricCard label="Pending copies" value={pendingCount} />
          <MetricCard label="Submission" value={`${submittedPercent}%`} />
          <MetricCard label="Exam copies" value={`${examIds.length}/${students.length}`} />
          <MetricCard label="Additional records" value={naRecords.length} />
        </div>
        <form className="teacher-copy-na-form" onSubmit={addNaStudent}>
          <div className="teacher-copy-na-heading">
            <div>
              <strong>Additional Student Record</strong>
              <span>Add a student entry that is not available in the class list.</span>
            </div>
            <button className="secondary-button teacher-copy-add-button" type="submit">
              <Plus size={17} /> Add Record
            </button>
          </div>
          <div className="teacher-copy-na-fields">
            <label className="field">
              <span>Student name</span>
              <input value={naStudent.studentName} onChange={(event) => updateNaStudent("studentName", event.target.value)} placeholder="Enter name" />
            </label>
            <label className="field">
              <span>Class</span>
              <input value={naStudent.className} onChange={(event) => updateNaStudent("className", event.target.value)} placeholder="Class" />
            </label>
            <label className="field">
              <span>Roll no.</span>
              <input value={naStudent.rollNo} onChange={(event) => updateNaStudent("rollNo", event.target.value)} placeholder="Optional" />
            </label>
            <label className="field">
              <span>Remark</span>
              <input value={naStudent.note} onChange={(event) => updateNaStudent("note", event.target.value)} placeholder="Manual copy record" />
            </label>
          </div>
        </form>
        <div className="teacher-copy-toolbar">
          <label className="teacher-copy-search">
            <Search size={17} />
            <input
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              placeholder="Search by student, roll, class, father"
            />
          </label>
          <div className="teacher-row-actions">
            <button className="secondary-button" type="button" disabled={!visibleStudentIds.length} onClick={markAllVisible}>
              Mark visible submitted
            </button>
            <button className="secondary-button" type="button" disabled={!visibleStudentIds.length} onClick={() => setStudentsForField("examCopyTakenStudentIds", visibleStudentIds, true)}>
              Mark visible exam
            </button>
            <button className="ghost-button" type="button" disabled={!visibleStudentIds.length} onClick={clearAllVisible}>
              Clear visible
            </button>
          </div>
        </div>
        <div className="teacher-copy-progress" aria-label="Copy submission progress">
          <span style={{ width: `${submittedPercent}%` }} />
          <i style={{ width: `${examPercent}%` }} />
        </div>
        <div className="responsive-table teacher-copy-table-wrap">
          <table className="teacher-student-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Status</th>
                <th>Copy submitted</th>
                <th>Exam copy taken</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => {
                const id = normalizeId(student);
                const copySubmitted = submittedIds.includes(id);
                const examCopyTaken = examIds.includes(id);
                return (
                  <tr key={id}>
                    <td>
                      <strong>{student.name}</strong>
                      <span>{student.rollNo ? `Roll ${student.rollNo}` : student.fatherName || ""}</span>
                    </td>
                    <td>{student.className || className}</td>
                    <td>
                      <span className={copySubmitted ? "teacher-copy-status done" : "teacher-copy-status pending"}>
                        {copySubmitted ? "Submitted" : "Pending"}
                      </span>
                    </td>
                    <td><CheckBox label="Submitted" checked={copySubmitted} onChange={() => toggleStudent("copySubmittedStudentIds", id)} /></td>
                    <td><CheckBox label="Taken" checked={examCopyTaken} onChange={() => toggleStudent("examCopyTakenStudentIds", id)} /></td>
                  </tr>
                );
              })}
              {naRecords.map((record) => (
                <tr className="teacher-na-row" key={record.id || record._id || `${record.studentName}-${record.className}-${record.rollNo}`}>
                  <td>
                    <strong>{record.studentName || "Unnamed student"}</strong>
                    <span>{record.rollNo ? `Roll ${record.rollNo}` : record.note || "Manual copy record"}</span>
                  </td>
                  <td>{record.className || "-"}</td>
                  <td><span className="teacher-copy-status manual">Manual</span></td>
                  <td>{record.note || "Not applicable"}</td>
                  <td>
                    <button className="ghost-button table-action" type="button" onClick={() => removeNaStudent(record.id || record._id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && naRecords.length === 0 && <div className="empty-state">No students found for this class.</div>}
          {students.length > 0 && visibleStudents.length === 0 && <div className="empty-state">No students match this search.</div>}
        </div>
        <button className="primary-button teacher-save-button" type="button" disabled={recordState.saving} onClick={() => recordState.save("Copy records saved.", { recordScope: "copy" })}>
          <ClipboardCheck size={18} /> {recordState.saving ? "Saving" : "Save Copy Records"}
        </button>
      </article>
    </div>
  );
}

function TeacherAttendancePage({ pairs }) {
  const classes = [...new Set(pairs.map((item) => item.className).filter(Boolean))];
  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Attendance" title="Assigned Class Shortcuts" />
      <div className="teacher-tile-grid">
        {classes.map((className) => (
          <Link className="teacher-tile" to={`/attendance?className=${encodeURIComponent(className)}`} key={className}>
            <CalendarCheck size={20} />
            <strong>{className}</strong>
            <span>Open attendance register</span>
          </Link>
        ))}
        {classes.length === 0 && <div className="empty-state">No assigned classes yet.</div>}
      </div>
    </div>
  );
}

function InboxPage({ setStatus }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    teacherAPI
      .getAnnouncements()
      .then((res) => {
        if (active) setAnnouncements(res.data || []);
      })
      .catch((error) => {
        if (active) setStatus(error.response?.data?.error || "Unable to load inbox.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [setStatus]);

  async function markRead(item) {
    try {
      const res = await teacherAPI.markAnnouncementRead(item._id);
      setAnnouncements((current) => current.map((announcement) => announcement._id === item._id ? res.data : announcement));
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to mark message read.");
    }
  }

  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Inbox" title="Admin Announcements" />
      <article className="chart-card teacher-full-card">
        {loading ? <div className="empty-state">Loading inbox.</div> : (
          <div className="teacher-inbox-list">
            {announcements.map((item) => (
              <div className={`teacher-inbox-item priority-${item.priority} ${item.read ? "" : "unread"}`} key={item._id}>
                <Bell size={18} />
                <div>
                  <strong>{item.title}</strong>
                  <span>{formatDate(item.createdAt)} - {item.priority}</span>
                  <p>{item.message}</p>
                </div>
                {!item.read && <button className="secondary-button" type="button" onClick={() => markRead(item)}>Mark read</button>}
              </div>
            ))}
            {announcements.length === 0 && <div className="empty-state">No announcements.</div>}
          </div>
        )}
      </article>
    </div>
  );
}

function ReportsPage({ setStatus }) {
  const [dateFrom, setDateFrom] = useState(monthStartIso);
  const [dateTo, setDateTo] = useState(monthEndIso);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    let active = true;
    teacherAPI
      .getWorkRecords({ dateFrom, dateTo })
      .then((res) => {
        if (active) setRecords(res.data || []);
      })
      .catch((error) => {
        if (active) setStatus(error.response?.data?.error || "Unable to load monthly report.");
      });
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, setStatus]);

  const report = {
    periods: records.filter((item) => item.periodStatus === "completed" || item.taughtToday).length,
    homework: records.filter((item) => item.homeworkText).length,
    plans: records.filter((item) => ["submitted", "reviewed", "approved", "needs_correction"].includes(item.reviewStatus)).length,
    syllabus: records.filter((item) => item.chapter || item.taughtToday).length,
    copies: records.reduce((sum, item) => sum + (item.copySubmittedStudentIds?.length || 0), 0),
  };

  function exportReport() {
    const rows = [
      ["Date", "Class", "Subject", "Period", "Homework", "Lesson Plan", "Chapter", "Taught Today", "Review"],
      ...records.map((item) => [
        formatDate(item.date),
        item.className,
        item.subject,
        item.periodStatus || "",
        item.homeworkText || "",
        item.lessonPlan || "",
        item.chapter || "",
        item.taughtToday || "",
        reviewLabels[item.reviewStatus] || item.reviewStatus || "",
      ]),
    ];
    downloadCsv("teacher-monthly-report.csv", rows);
  }

  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Reports" title="Monthly Teacher Report" />
      <article className="chart-card teacher-full-card">
        <div className="teacher-context-grid">
          <label className="field">
            <span>From</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <button className="primary-button" type="button" onClick={exportReport}>Export CSV</button>
        </div>
      </article>
      <div className="teacher-copy-summary">
        <MetricCard label="Periods taken" value={report.periods} />
        <MetricCard label="Homework given" value={report.homework} />
        <MetricCard label="Plans submitted" value={report.plans} />
        <MetricCard label="Syllabus covered" value={report.syllabus} />
        <MetricCard label="Copies checked" value={report.copies} />
      </div>
      <article className="chart-card teacher-full-card">
        <PortalHeading eyebrow="Records" title="Report Details" compact />
        <div className="teacher-history-list">
          {records.map((item) => (
            <div className="teacher-history-item" key={item._id}>
              <strong>{formatDate(item.date)} - {item.className} - {item.subject}</strong>
              <span>{item.taughtToday || item.homeworkText || item.chapter || "Record saved"}</span>
            </div>
          ))}
          {records.length === 0 && <div className="empty-state">No records for this date range.</div>}
        </div>
      </article>
    </div>
  );
}

function ProfileAssignmentsPage({
  profile,
  classOptions,
  updateProfile,
  updateAssignment,
  addAssignment,
  removeAssignment,
  saveProfile,
}) {
  return (
    <div className="teacher-section-grid">
      <PortalHeading eyebrow="Profile" title="Teacher Information and Assignments" />
      <form className="chart-card teacher-full-card" onSubmit={saveProfile}>
        <div className="form-grid">
          <Field label="Employee code" value={profile.employeeCode || ""} onChange={(value) => updateProfile("employeeCode", value)} />
          <Field label="Designation" value={profile.designation || ""} onChange={(value) => updateProfile("designation", value)} />
          <Field label="Department" value={profile.department || ""} onChange={(value) => updateProfile("department", value)} />
          <Field label="Qualification" value={profile.qualification || ""} onChange={(value) => updateProfile("qualification", value)} />
          <Field label="Experience years" type="number" value={profile.experienceYears ?? ""} onChange={(value) => updateProfile("experienceYears", value)} />
          <Field label="Alternate phone" value={profile.alternatePhone || ""} onChange={(value) => updateProfile("alternatePhone", value.replace(/\D/g, "").slice(0, 10))} />
        </div>
        <label className="field">
          <span>Subjects</span>
          <input value={(profile.subjects || []).join(", ")} onChange={(event) => updateProfile("subjects", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
        </label>
        <label className="field">
          <span>Address</span>
          <textarea rows={2} value={profile.address || ""} onChange={(event) => updateProfile("address", event.target.value)} />
        </label>
        <label className="field">
          <span>About</span>
          <textarea rows={3} value={profile.about || ""} onChange={(event) => updateProfile("about", event.target.value)} />
        </label>

        <div className="teacher-block-heading">
          <div>
            <span className="eyebrow">Classes</span>
            <h4>Subjects Taught</h4>
          </div>
          <button className="secondary-button" type="button" onClick={addAssignment}><Plus size={16} /> Add</button>
        </div>

        <div className="teacher-list-editor">
          {(profile.assignments || []).map((item, index) => (
            <div className="teacher-assignment-row" key={item._id || index}>
              <select value={item.className || ""} onChange={(event) => updateAssignment(index, "className", event.target.value)}>
                <option value="">Class</option>
                {classOptions.map((className) => <option key={className}>{className}</option>)}
              </select>
              <input value={item.subject || ""} onChange={(event) => updateAssignment(index, "subject", event.target.value)} placeholder="Subject" />
              <button className="icon-button table-icon-action danger" type="button" onClick={() => removeAssignment(index)} aria-label="Remove assignment">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {profile.assignments?.length === 0 && <div className="compact-empty">No class subjects added.</div>}
        </div>

        <button className="primary-button teacher-save-button" type="submit"><Save size={18} /> Save Profile</button>
      </form>
    </div>
  );
}

function ScheduleEditor({ profile, classOptions, updateSchedule, addSchedule, removeSchedule, saveProfile }) {
  return (
    <form className="chart-card teacher-full-card" onSubmit={saveProfile}>
      <div className="teacher-block-heading">
        <div>
          <span className="eyebrow">Timetable</span>
          <h4>Assigned Period Schedule</h4>
        </div>
        <button className="secondary-button" type="button" onClick={addSchedule}><Plus size={16} /> Add</button>
      </div>
      <div className="teacher-schedule-list">
        {(profile.schedule || []).map((item, index) => (
          <div className="teacher-schedule-row" key={item._id || index}>
            <select value={item.day || "Daily"} onChange={(event) => updateSchedule(index, "day", event.target.value)}>
              {days.map((day) => <option key={day}>{day}</option>)}
            </select>
            <input value={item.period || ""} onChange={(event) => updateSchedule(index, "period", event.target.value)} placeholder="Period" />
            <select value={item.className || ""} onChange={(event) => updateSchedule(index, "className", event.target.value)}>
              <option value="">Class</option>
              {classOptions.map((className) => <option key={className}>{className}</option>)}
            </select>
            <input value={item.subject || ""} onChange={(event) => updateSchedule(index, "subject", event.target.value)} placeholder="Subject" />
            <input type="time" value={item.startTime || ""} onChange={(event) => updateSchedule(index, "startTime", event.target.value)} />
            <input type="time" value={item.endTime || ""} onChange={(event) => updateSchedule(index, "endTime", event.target.value)} />
            <button className="icon-button table-icon-action danger" type="button" onClick={() => removeSchedule(index)} aria-label="Remove schedule">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {profile.schedule?.length === 0 && <div className="compact-empty">No period schedule added.</div>}
      </div>
      <button className="primary-button teacher-save-button" type="submit"><Save size={18} /> Save Schedule</button>
    </form>
  );
}

function useTeacherRecord({ date, className, subject, setStatus }) {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(emptyWork);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!date || !className || !subject) return undefined;
    let active = true;
    teacherAPI
      .getWorkRecords({ date, className, subject })
      .then((res) => {
        if (!active) return;
        const nextRecord = res.data?.[0] || null;
        setRecord(nextRecord);
        setForm(normalizeRecord(nextRecord));
      })
      .catch((error) => {
        if (active) setStatus(error.response?.data?.error || "Unable to load saved record.");
      });
    return () => {
      active = false;
    };
  }, [date, className, subject, setStatus]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(successMessage, extraData = {}) {
    if (!date || !className || !subject) {
      setStatus("Select a class and subject first.");
      return;
    }
    try {
      setSaving(true);
      const res = await teacherAPI.saveWorkRecord({ date, className, subject, ...form, ...extraData });
      setRecord(res.data);
      setForm(normalizeRecord(res.data));
      setStatus(successMessage);
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save teacher record.");
    } finally {
      setSaving(false);
    }
  }

  return { record, form, setForm, update, save, saving };
}

function TeacherSelector({ pairs, date, setDate, className, setClassName, subject, setSubject }) {
  const classOptions = [...new Set(pairs.map((item) => item.className).filter(Boolean))].sort();
  const subjectOptions = [...new Set(pairs.filter((item) => item.className === className).map((item) => item.subject).filter(Boolean))].sort();
  return (
    <div className="teacher-context-grid">
      <label className="field">
        <span>Date</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label className="field">
        <span>Class</span>
        <select value={className} onChange={(event) => {
          const nextClass = event.target.value;
          setClassName(nextClass);
          const nextSubject = pairs.find((item) => item.className === nextClass)?.subject || "";
          setSubject(nextSubject);
        }}>
          <option value="">Select class</option>
          {classOptions.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Subject</span>
        <select value={subject} onChange={(event) => setSubject(event.target.value)}>
          <option value="">Select subject</option>
          {subjectOptions.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
    </div>
  );
}

function PortalHeading({ eyebrow, title, compact }) {
  return (
    <div className={compact ? "teacher-compact-heading" : "teacher-page-heading"}>
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="teacher-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function TeacherTile({ to, icon, title, text }) {
  return (
    <Link className="teacher-tile" to={to}>
      {createElement(icon, { size: 20 })}
      <strong>{title}</strong>
      <span>{text}</span>
    </Link>
  );
}

function StatusPill({ value }) {
  return <span className={`teacher-status-pill status-${value}`}>{value}</span>;
}

function CheckBox({ checked, onChange, label = "Marked" }) {
  return (
    <label className="teacher-check">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function getDefaultPair(pairs) {
  return pairs[0] || { className: "", subject: "" };
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN");
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

export default TeacherWorkspacePage;
