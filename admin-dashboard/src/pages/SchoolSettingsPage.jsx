import { useEffect, useMemo, useState } from "react";
import { BookOpen, Bus, FileBadge, GraduationCap, Plus, ReceiptText, Save, School, ShieldCheck, X } from "lucide-react";
import { authAPI, erpAPI, uploadsAPI } from "../api";
import { applySchoolBranding } from "../utils/branding";

const emptySettings = {
  schoolName: "",
  shortName: "",
  logoUrl: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  phone: "",
  email: "",
  website: "",
  academicYear: "",
  idCardFormat: "",
  marksheetFormat: "",
  classes: [],
  sections: [],
  subjects: [],
  feeHeads: [],
  transportRoutes: [],
};

const masterGroups = [
  { key: "classes", label: "Classes", placeholder: "Class name", icon: GraduationCap },
  { key: "sections", label: "Sections", placeholder: "Section name", icon: BookOpen },
  { key: "subjects", label: "Subjects", placeholder: "Subject name", icon: School },
  { key: "feeHeads", label: "Fee Heads", placeholder: "Fee head", icon: ReceiptText },
  { key: "transportRoutes", label: "Transport Routes", placeholder: "Route name", icon: Bus },
];

function SchoolSettingsPage() {
  const [recordId, setRecordId] = useState("");
  const [status, setStatus] = useState("Loading school settings...");
  const [logoStatus, setLogoStatus] = useState("");
  const [form, setForm] = useState(emptySettings);
  const [drafts, setDrafts] = useState(masterGroups.reduce((items, group) => ({ ...items, [group.key]: "" }), {}));

  useEffect(() => {
    let active = true;

    erpAPI
      .list("schoolSettings")
      .then((res) => {
        if (!active) return;
        const saved = res.data?.[0];
        if (saved) {
          setRecordId(saved._id || saved.id || "");
          setForm(normalizeSettings(saved.payload));
        }
        setStatus("");
      })
      .catch(() => {
        if (active) setStatus("Settings can be saved when backend is available.");
      });

    return () => {
      active = false;
    };
  }, []);

  const setupCount = useMemo(
    () => masterGroups.reduce((total, group) => total + form[group.key].length, 0),
    [form]
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateDraft(key, value) {
    setDrafts((current) => ({ ...current, [key]: value }));
  }

  function addMasterItem(key) {
    const value = drafts[key].trim();
    if (!value) return;

    setForm((current) => {
      if (current[key].some((item) => item.toLowerCase() === value.toLowerCase())) return current;
      return { ...current, [key]: [...current[key], value] };
    });
    setDrafts((current) => ({ ...current, [key]: "" }));
  }

  function removeMasterItem(key, value) {
    setForm((current) => ({ ...current, [key]: current[key].filter((item) => item !== value) }));
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoStatus("Only image files are allowed.");
      return;
    }

    try {
      setLogoStatus("Uploading logo...");
      const res = await uploadsAPI.image(file);
      updateForm("logoUrl", res.data.fileUrl);
      setLogoStatus("Logo uploaded.");
    } catch (error) {
      setLogoStatus(error.response?.data?.error || "Logo upload failed.");
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!form.schoolName.trim()) {
      setStatus("School name is required.");
      return;
    }
    if (!form.superadminPassword) {
      setStatus("Enter superadmin password to save settings.");
      return;
    }

    const payload = normalizeSettings(form);

    try {
      await authAPI.confirmPassword(form.superadminPassword);
      const recordPayload = {
        referenceNo: "SCHOOL-SETTINGS",
        title: payload.schoolName,
        groupName: payload.academicYear || "Master setup",
        status: "Active",
        payload,
      };
      const res = recordId
        ? await erpAPI.update("schoolSettings", recordId, recordPayload)
        : await erpAPI.create("schoolSettings", recordPayload);

      setRecordId(res.data?._id || recordId);
      setForm({ ...payload, superadminPassword: "" });
      applySchoolBranding(payload);
      setStatus("School settings saved.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Unable to save settings.");
    }
  }

  return (
    <div className="settings-page">
      <section className="module-hero">
        <div>
          <span className="eyebrow">Superadmin</span>
          <h2>School Settings</h2>
        </div>
        <div className="settings-summary">
          <strong>{setupCount}</strong>
          <span>Master items</span>
        </div>
      </section>

      {status && <div className="inline-alert">{status}</div>}

      <form className="workspace-grid" onSubmit={saveSettings}>
        <article className="chart-card wide">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Profile</span>
              <h3>School Identity</h3>
            </div>
            <School size={20} />
          </div>

          <div className="form-grid">
            <Field label="School name" value={form.schoolName} onChange={(value) => updateForm("schoolName", value)} required />
            <Field label="Short name" value={form.shortName} onChange={(value) => updateForm("shortName", value)} />
            <Field label="Academic year" value={form.academicYear} onChange={(value) => updateForm("academicYear", value)} />
            <label className="field logo-upload-field">
              <span>School logo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadLogo} />
              {logoStatus && <small>{logoStatus}</small>}
              {form.logoUrl && (
                <div className="logo-preview">
                  <img src={form.logoUrl} alt="School logo" />
                  <span>{form.logoUrl}</span>
                </div>
              )}
            </label>
            <Field label="Mobile" value={form.phone} onChange={(value) => updateForm("phone", value.replace(/\D/g, "").slice(0, 10))} />
            <Field label="Email" type="email" value={form.email} onChange={(value) => updateForm("email", value)} />
            <Field label="Website" type="url" value={form.website} onChange={(value) => updateForm("website", value)} />
            <Field label="PIN code" value={form.pinCode} onChange={(value) => updateForm("pinCode", value.replace(/\D/g, "").slice(0, 6))} />
          </div>

          <div className="form-grid single">
            <Field label="Address" value={form.address} onChange={(value) => updateForm("address", value)} />
            <Field label="City" value={form.city} onChange={(value) => updateForm("city", value)} />
            <Field label="State" value={form.state} onChange={(value) => updateForm("state", value)} />
          </div>
        </article>

        <article className="chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Documents</span>
              <h3>Formats</h3>
            </div>
            <FileBadge size={20} />
          </div>

          <div className="form-grid single">
            <label className="field">
              <span>ID card format</span>
              <select value={form.idCardFormat} onChange={(event) => updateForm("idCardFormat", event.target.value)}>
                <option value="">Select format</option>
                <option value="standard">Standard</option>
                <option value="compact">Compact</option>
                <option value="photo-first">Photo first</option>
              </select>
            </label>
            <label className="field">
              <span>Marksheet format</span>
              <select value={form.marksheetFormat} onChange={(event) => updateForm("marksheetFormat", event.target.value)}>
                <option value="">Select format</option>
                <option value="term">Term wise</option>
                <option value="annual">Annual</option>
                <option value="grade">Grade based</option>
              </select>
            </label>
            <Field
              label="Superadmin password"
              type="password"
              value={form.superadminPassword || ""}
              onChange={(value) => updateForm("superadminPassword", value)}
              required
            />
          </div>

          <button className="primary-button settings-save-button" type="submit">
            <Save size={18} /> Save Settings
          </button>
        </article>

        <section className="chart-card wide master-setup-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Master Setup</span>
              <h3>Academic Controls</h3>
            </div>
            <ShieldCheck size={20} />
          </div>

          <div className="master-grid">
            {masterGroups.map((group) => (
              <MasterGroup
                key={group.key}
                group={group}
                items={form[group.key]}
                draft={drafts[group.key]}
                onDraftChange={(value) => updateDraft(group.key, value)}
                onAdd={() => addMasterItem(group.key)}
                onRemove={(value) => removeMasterItem(group.key, value)}
              />
            ))}
          </div>
        </section>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function MasterGroup({ group, items, draft, onDraftChange, onAdd, onRemove }) {
  const Icon = group.icon;

  return (
    <div className="master-group">
      <div className="master-group-header">
        <Icon size={18} />
        <strong>{group.label}</strong>
      </div>
      <div className="master-input-row">
        <input value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder={group.placeholder} />
        <button className="icon-button" type="button" onClick={onAdd} aria-label={`Add ${group.label}`}>
          <Plus size={16} />
        </button>
      </div>
      <div className="master-chip-list">
        {items.map((item) => (
          <span className="master-chip" key={item}>
            {item}
            <button type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item}`}>
              <X size={13} />
            </button>
          </span>
        ))}
        {items.length === 0 && <small>No items added.</small>}
      </div>
    </div>
  );
}

function normalizeSettings(settings = {}) {
  const normalized = { ...emptySettings, ...settings };
  delete normalized.superadminPassword;
  masterGroups.forEach((group) => {
    normalized[group.key] = Array.isArray(normalized[group.key])
      ? normalized[group.key].map((item) => String(item).trim()).filter(Boolean)
      : [];
  });
  return normalized;
}

export default SchoolSettingsPage;
