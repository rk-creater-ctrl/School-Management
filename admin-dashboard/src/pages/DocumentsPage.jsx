import { useMemo, useState } from "react";
import { BadgeCheck, FileText, IdCard, Printer, Upload } from "lucide-react";

const defaultSubjects = [
  { subject: "", marks: "", max: "" },
  { subject: "", marks: "", max: "" },
  { subject: "", marks: "", max: "" },
  { subject: "", marks: "", max: "" },
  { subject: "", marks: "", max: "" },
];

function DocumentsPage() {
  const [activeTab, setActiveTab] = useState("marksheet");
  const [idPhoto, setIdPhoto] = useState("");
  const [student, setStudent] = useState({
    name: "",
    fatherName: "",
    schoolName: "",
    mobile: "",
    dob: "",
    studentCode: "",
    className: "",
    rollNo: "",
    examName: "",
    academicYear: "",
  });
  const [subjects, setSubjects] = useState(defaultSubjects);

  const totals = useMemo(() => {
    const obtained = subjects.reduce((sum, row) => sum + Number(row.marks || 0), 0);
    const maximum = subjects.reduce((sum, row) => sum + Number(row.max || 0), 0);
    const percent = maximum ? (obtained / maximum) * 100 : 0;
    return {
      obtained,
      maximum,
      percent,
      grade: percent >= 90 ? "A+" : percent >= 75 ? "A" : percent >= 60 ? "B" : percent >= 45 ? "C" : "D",
    };
  }, [subjects]);

  function updateStudent(field, value) {
    setStudent((current) => ({ ...current, [field]: value }));
  }

  function updateSubject(index, field, value) {
    setSubjects((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  function addSubject() {
    setSubjects((current) => [...current, { subject: "", marks: "", max: "" }]);
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIdPhoto(URL.createObjectURL(file));
  }

  function printDocument() {
    window.print();
  }

  return (
    <div className="documents-page">
      <section className="module-hero no-print">
        <div>
          <span className="eyebrow">Documents</span>
          <h2>Generate marksheets and ID cards.</h2>
          <p>Create printable school records with student details, marks, photo, parent details, mobile number, DOB, and 10 digit student code.</p>
        </div>
        <div className="module-actions">
          <button className={activeTab === "marksheet" ? "primary-button" : "secondary-button"} onClick={() => setActiveTab("marksheet")}>
            <FileText size={18} /> Marksheet
          </button>
          <button className={activeTab === "idcard" ? "primary-button" : "secondary-button"} onClick={() => setActiveTab("idcard")}>
            <IdCard size={18} /> ID Card
          </button>
          <button className="secondary-button" onClick={printDocument}>
            <Printer size={18} /> Print
          </button>
        </div>
      </section>

      <section className="document-workspace">
        <aside className="chart-card no-print">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Student details</span>
              <h3>Record</h3>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Name" value={student.name} onChange={(value) => updateStudent("name", value)} />
            <Field label="Father's name" value={student.fatherName} onChange={(value) => updateStudent("fatherName", value)} />
            <Field label="School name" value={student.schoolName} onChange={(value) => updateStudent("schoolName", value)} />
            <Field label="Mobile number" value={student.mobile} onChange={(value) => updateStudent("mobile", value)} maxLength={10} />
            <Field label="DOB" type="date" value={student.dob} onChange={(value) => updateStudent("dob", value)} />
            <Field label="10 digit student code" value={student.studentCode} onChange={(value) => updateStudent("studentCode", value)} maxLength={10} />
            <Field label="Class" value={student.className} onChange={(value) => updateStudent("className", value)} />
            <Field label="Roll no." value={student.rollNo} onChange={(value) => updateStudent("rollNo", value)} />
          </div>

          {activeTab === "marksheet" && (
            <>
              <div className="section-heading compact-heading">
                <div>
                  <span className="eyebrow">Marks</span>
                  <h3>Subjects</h3>
                </div>
                <button className="ghost-button" onClick={addSubject}>Add</button>
              </div>
              <div className="subject-editor">
                {subjects.map((row, index) => (
                  <div className="subject-row" key={index}>
                    <input value={row.subject} onChange={(event) => updateSubject(index, "subject", event.target.value)} placeholder="Subject" />
                    <input value={row.marks} onChange={(event) => updateSubject(index, "marks", event.target.value)} placeholder="Marks" type="number" />
                    <input value={row.max} onChange={(event) => updateSubject(index, "max", event.target.value)} placeholder="Max" type="number" />
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "idcard" && (
            <label className="upload-strip">
              <Upload size={17} />
              <span>Upload photo</span>
              <input type="file" accept="image/*" onChange={handlePhoto} />
            </label>
          )}
        </aside>

        <main className="document-preview">
          {activeTab === "marksheet" ? (
            <Marksheet student={student} subjects={subjects} totals={totals} />
          ) : (
            <IdCardPreview student={student} photo={idPhoto} />
          )}
        </main>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", maxLength }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Marksheet({ student, subjects, totals }) {
  return (
    <article className="marksheet-paper print-area">
      <header className="document-header">
        <BadgeCheck size={34} />
        <div>
          <h2>{student.schoolName}</h2>
          <p>{student.examName} | {student.academicYear}</p>
        </div>
      </header>
      <div className="document-meta">
        <span>Name: <strong>{student.name}</strong></span>
        <span>Father: <strong>{student.fatherName}</strong></span>
        <span>Class: <strong>{student.className}</strong></span>
        <span>Roll No: <strong>{student.rollNo}</strong></span>
        <span>Student Code: <strong>{student.studentCode}</strong></span>
        <span>DOB: <strong>{student.dob}</strong></span>
      </div>
      <table className="document-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Marks</th>
            <th>Max</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((row, index) => (
            <tr key={index}>
              <td>{row.subject || "-"}</td>
              <td>{row.marks || 0}</td>
              <td>{row.max || 0}</td>
              <td>{Number(row.marks || 0) >= Number(row.max || 0) * 0.33 ? "Pass" : "Review"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="document-footer">
        <span>Total: <strong>{totals.obtained}/{totals.maximum}</strong></span>
        <span>Percentage: <strong>{totals.percent.toFixed(1)}%</strong></span>
        <span>Grade: <strong>{totals.grade}</strong></span>
      </footer>
    </article>
  );
}

function IdCardPreview({ student, photo }) {
  return (
    <article className="id-card-preview print-area">
      <div className="id-card-band">{student.schoolName}</div>
      <div className="id-card-body">
        <div className="photo-box">{photo ? <img src={photo} alt="" /> : <span>Photo</span>}</div>
        <h2>{student.name}</h2>
        <p>{student.className}</p>
        <div className="id-card-lines">
          <span>Father: <strong>{student.fatherName}</strong></span>
          <span>Code: <strong>{student.studentCode}</strong></span>
          <span>DOB: <strong>{student.dob}</strong></span>
          <span>Mobile: <strong>{student.mobile}</strong></span>
        </div>
      </div>
    </article>
  );
}

export default DocumentsPage;
