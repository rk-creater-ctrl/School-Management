import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail, School, ShieldCheck } from "lucide-react";
import { authAPI, erpAPI } from "../api";
import { applySchoolBranding } from "../utils/branding";

function LoginPage() {
  const [form, setForm] = useState({
    identifier: "",
    password: "",
    remember: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function completeSession(token, user) {
    localStorage.removeItem("erp_token");
    localStorage.removeItem("erp_user");
    sessionStorage.removeItem("erp_token");
    sessionStorage.removeItem("erp_user");

    const storage = form.remember ? localStorage : sessionStorage;
    storage.setItem("erp_token", token);
    storage.setItem("erp_user", JSON.stringify({
      name: user?.name || "",
      username: user?.username || "",
      email: user?.email || "",
      phone: user?.phone || "",
      role: user?.role || "admin",
      campus: user?.campus || "School ERP",
      academicYear: user?.academicYear || "2026-27",
    }));

    try {
      const settings = await erpAPI.list("schoolSettings");
      applySchoolBranding(settings.data?.[0]?.payload);
    } catch {
      applySchoolBranding();
    }

    navigate("/");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await authAPI.login({
        identifier: form.identifier,
        email: form.identifier,
        password: form.password,
      });
      await completeSession(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page signin-only-page">
      <section className="auth-visual signin-visual">
        <div className="brand-row">
          <div className="brand-mark">S</div>
          <div>
            <strong>School ERP</strong>
            <span>Secure access</span>
          </div>
        </div>

        <div className="signin-panel-art">
          <ShieldCheck size={46} />
          <strong>Authorized Sign In</strong>
          <span>Use the username and password created by superadmin or admin.</span>
        </div>
      </section>

      <form className="auth-card enhanced-auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-header">
          <School size={30} />
          <div>
            <span className="eyebrow">Access</span>
            <h2>Sign In Now</h2>
          </div>
        </div>

        <label className="field">
          <span>Username or Email</span>
          <div className="input-with-icon">
            <Mail size={17} />
            <input value={form.identifier} onChange={(event) => updateForm("identifier", event.target.value)} required />
          </div>
        </label>

        <label className="field">
          <span>Password</span>
          <div className="input-with-icon">
            <LockKeyhole size={17} />
            <input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => updateForm("password", event.target.value)} required />
            <button className="field-icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <label className="toggle-row">
          <input type="checkbox" checked={form.remember} onChange={(event) => updateForm("remember", event.target.checked)} />
          <span>Remember session</span>
        </label>

        {error && <p className="inline-alert">{error}</p>}

        <div className="auth-actions auth-actions-single">
          <button className="primary-button auth-submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In Now"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default LoginPage;
