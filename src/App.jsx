import { useState, useEffect, useRef } from "react";

// ─── PIN CONFIG ───────────────────────────────────────────────────────────────
// Change this to your desired PIN (can be any length)
const APP_PIN = import.meta.env.VITE_APP_PIN || "1234";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Food & Drink", "Transport", "Shopping", "Health",
  "Utilities", "Entertainment", "Travel", "Other",
];
const CATEGORY_COLORS = {
  "Food & Drink": "#e07b39", "Transport": "#4a90d9", "Shopping": "#9b59b6",
  "Health": "#27ae60", "Utilities": "#7f8c8d", "Entertainment": "#e74c3c",
  "Travel": "#16a085", "Other": "#8e9b6a",
};
const CATEGORY_ICONS = {
  "Food & Drink": "🍽️", "Transport": "🚗", "Shopping": "🛍️", "Health": "💊",
  "Utilities": "⚡", "Entertainment": "🎬", "Travel": "✈️", "Other": "📋",
};
const STORAGE_KEY    = "receiptkeep_v1";
const ATTEMPTS_KEY   = "rk_attempts";
const LOCKOUT_KEY    = "rk_lockout";
const SESSION_KEY    = "rk_unlocked";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId    = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today    = () => new Date().toISOString().split("T")[0];
const fmtMoney = (n) => "$" + n.toFixed(2);
const fmtDate  = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

function loadData()         { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveData(receipts) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts)); } catch {} }

// ─── AI Extraction ────────────────────────────────────────────────────────────
async function scanReceiptImage(base64, mediaType) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("API key missing — add VITE_ANTHROPIC_API_KEY to .env.local");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: `Analyse this receipt. Reply ONLY with valid JSON — no markdown, no explanation.
{
  "store": "merchant name",
  "amount": total as number e.g. 12.50,
  "date": "YYYY-MM-DD (today if not visible)",
  "category": one of: "Food & Drink"|"Transport"|"Shopping"|"Health"|"Utilities"|"Entertainment"|"Travel"|"Other",
  "notes": "brief item summary or empty string"
}`,
          },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

:root {
  --bg: #f5f0e8; --card: #fffef9; --ink: #1a1a1a; --muted: #888;
  --border: #ede8dc; --input-border: #d4cebe; --danger: #c0392b;
  --success: #27ae60; --font-sans: 'DM Sans',sans-serif;
  --font-mono: 'DM Mono',monospace; --font-display: 'Playfair Display',serif;
  --safe-bottom: env(safe-area-inset-bottom,0px);
}

/* ── PIN screen ── */
.pin-screen {
  min-height:100vh; min-height:100dvh; background:#1a1a1a;
  display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:0; padding:32px 24px;
  font-family:var(--font-sans);
}
.pin-logo      { font-size:52px; margin-bottom:12px; }
.pin-title     { font-family:var(--font-display); font-size:26px; font-weight:900; color:#f5f0e8; margin-bottom:4px; }
.pin-subtitle  { font-size:13px; color:#666; margin-bottom:36px; letter-spacing:.04em; }
.pin-dots      { display:flex; gap:14px; margin-bottom:28px; }
.pin-dot       { width:14px; height:14px; border-radius:50%; border:2px solid #444; background:transparent; transition:all .15s; }
.pin-dot.filled { background:#f5f0e8; border-color:#f5f0e8; }
.pin-error     { color:#e74c3c; font-size:13px; font-weight:500; margin-bottom:16px; min-height:20px; text-align:center; }
.pin-pad       { display:grid; grid-template-columns:repeat(3,72px); gap:12px; }
.pin-key       { width:72px; height:72px; border-radius:50%; border:1.5px solid #333; background:transparent; color:#f5f0e8; font-family:var(--font-sans); font-size:22px; font-weight:500; cursor:pointer; transition:all .15s; display:flex; align-items:center; justify-content:center; }
.pin-key:hover { background:#2a2a2a; border-color:#555; }
.pin-key:active{ background:#333; transform:scale(.94); }
.pin-key.del   { font-size:20px; border-color:transparent; }
.pin-key.empty { border-color:transparent; cursor:default; }
.pin-lockout   { color:#e74c3c; font-size:14px; font-weight:600; text-align:center; line-height:1.6; }
.pin-attempts  { color:#666; font-size:12px; margin-top:20px; }

/* ── App shell ── */
.app { min-height:100vh; min-height:100dvh; background:var(--bg); font-family:var(--font-sans); }
.card { background:var(--card); border-radius:3px; box-shadow:0 2px 8px rgba(0,0,0,.07),0 0 0 1px rgba(0,0,0,.05); }
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; border-radius:3px; font-family:var(--font-sans); font-weight:500; cursor:pointer; transition:all .15s; border:none; }
.btn-primary { background:var(--ink); color:var(--bg); padding:13px 24px; font-size:15px; width:100%; }
.btn-primary:hover:not(:disabled) { background:#2d2d2d; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.15); }
.btn-primary:disabled { opacity:.55; cursor:not-allowed; }
.btn-primary.danger { background:var(--danger); }
.btn-outline { background:transparent; border:1.5px solid var(--ink); color:var(--ink); padding:10px 18px; font-size:14px; }
.btn-outline:hover { background:var(--ink); color:var(--bg); }
.btn-sm { padding:6px 14px; font-size:13px; }
.field { display:flex; flex-direction:column; gap:6px; }
.label { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.input { width:100%; border:1.5px solid var(--input-border); background:#fafaf5; border-radius:3px; padding:11px 14px; font-family:var(--font-sans); font-size:15px; color:var(--ink); outline:none; transition:border .15s; appearance:none; }
.input:focus { border-color:var(--ink); background:#fff; }
.input.err { border-color:var(--danger); }
.input-mono { font-family:var(--font-mono); }
.err-msg { font-size:12px; color:var(--danger); }
select.input { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 14px center; background-color:#fafaf5; padding-right:38px; }
.header { background:var(--ink); color:var(--bg); padding:18px 20px 14px; text-align:center; position:sticky; top:0; z-index:100; }
.header-inner { display:flex; align-items:center; justify-content:center; position:relative; }
.header-title { font-family:var(--font-display); font-size:22px; font-weight:900; }
.header-sub { font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#777; margin-top:2px; }
.lock-btn { position:absolute; right:0; background:none; border:none; cursor:pointer; color:#666; font-size:18px; padding:4px 8px; line-height:1; transition:color .15s; }
.lock-btn:hover { color:#f5f0e8; }
.bottom-nav { position:fixed; bottom:0; left:0; right:0; background:var(--card); border-top:1.5px solid var(--border); display:flex; justify-content:space-around; padding:8px 0; padding-bottom:calc(8px + var(--safe-bottom)); z-index:200; }
.nav-btn { display:flex; flex-direction:column; align-items:center; gap:2px; padding:6px 20px; background:none; border:none; cursor:pointer; }
.nav-btn .nav-icon { font-size:22px; color:#ccc; line-height:1; }
.nav-btn .nav-label { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#ccc; }
.nav-btn.active .nav-icon, .nav-btn.active .nav-label { color:var(--ink); }
.page { padding:20px 16px; padding-bottom:calc(80px + var(--safe-bottom)); }
.stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
.stat-card { padding:16px; }
.stat-label { font-size:10px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.stat-num { font-family:var(--font-display); font-size:28px; font-weight:900; color:var(--ink); line-height:1; }
.stat-sub { font-size:12px; color:var(--muted); margin-top:4px; }
.section-label { font-size:10px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
.receipt-list .receipt-row { display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid var(--border); transition:background .1s; }
.receipt-list .receipt-row:last-child { border-bottom:none; }
.receipt-list .receipt-row:active { background:#faf9f4; }
.row-icon { font-size:24px; width:44px; text-align:center; flex-shrink:0; }
.row-thumb { width:44px; height:44px; object-fit:cover; border-radius:3px; border:1px solid var(--border); flex-shrink:0; cursor:pointer; }
.row-info { flex:1; min-width:0; }
.row-name { font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.row-meta { display:flex; gap:6px; margin-top:3px; align-items:center; flex-wrap:wrap; }
.row-date { font-size:11px; color:var(--muted); }
.row-notes { font-size:11px; color:#aaa; font-style:italic; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.row-amount { font-family:var(--font-mono); font-weight:700; font-size:15px; flex-shrink:0; }
.row-actions { display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
.del-btn { background:none; border:none; cursor:pointer; color:#ddd; font-size:17px; padding:0; transition:color .15s; line-height:1; }
.del-btn:hover { color:var(--danger); }
.tag { display:inline-flex; align-items:center; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:600; }
.cat-row { margin-bottom:13px; }
.cat-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; }
.cat-name { font-size:13px; font-weight:500; }
.cat-amount { font-family:var(--font-mono); font-size:13px; font-weight:600; }
.bar { height:6px; background:var(--border); border-radius:3px; overflow:hidden; }
.bar-fill { height:100%; border-radius:3px; transition:width .5s ease; }
.cat-sub { font-size:11px; color:var(--muted); margin-top:3px; }
.upload-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px; }
.upload-btn { display:flex; align-items:center; justify-content:center; gap:8px; padding:16px; border:1.5px solid var(--ink); border-radius:3px; background:transparent; font-family:var(--font-sans); font-size:14px; font-weight:500; color:var(--ink); cursor:pointer; transition:all .15s; width:100%; }
.upload-btn:hover { background:var(--ink); color:var(--bg); }
.upload-hint { font-size:11px; color:#aaa; text-align:center; }
.img-preview-wrap { position:relative; border-radius:3px; overflow:hidden; border:1px solid var(--border); margin-bottom:10px; }
.img-preview { width:100%; max-height:220px; object-fit:contain; background:var(--bg); display:block; }
.scan-overlay { position:absolute; inset:0; background:rgba(255,254,249,.9); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; }
.scan-icon { font-size:40px; animation:pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.scan-text { font-size:14px; font-weight:600; }
.scan-sub { font-size:12px; color:var(--muted); }
.alert { padding:10px 14px; border-radius:3px; font-size:13px; margin-bottom:10px; }
.alert-success { background:#f0fdf4; color:#166534; }
.alert-error { background:#fdf0f0; color:var(--danger); }
.dashed { border:none; border-top:1.5px dashed var(--input-border); margin:18px 0; }
.divider-text { text-align:center; font-size:11px; color:#ccc; letter-spacing:.06em; margin-bottom:16px; }
.toast { position:fixed; top:20px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:3px; font-family:var(--font-sans); font-size:14px; font-weight:500; z-index:9999; white-space:nowrap; animation:toastIn .2s ease; box-shadow:0 4px 20px rgba(0,0,0,.2); }
.toast-success { background:var(--ink); color:var(--bg); }
.toast-error { background:var(--danger); color:#fff; }
@keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(-8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
.modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:500; display:flex; align-items:center; justify-content:center; padding:24px; }
.modal { padding:28px 24px; max-width:320px; width:100%; text-align:center; }
.modal-icon { font-size:38px; margin-bottom:12px; }
.modal-title { font-family:var(--font-display); font-size:20px; font-weight:700; margin-bottom:8px; }
.modal-body { color:#666; font-size:14px; margin-bottom:24px; line-height:1.5; }
.modal-actions { display:flex; gap:12px; justify-content:center; }
.img-modal-inner { max-width:460px; width:100%; }
.img-modal-inner img { width:100%; border-radius:4px; box-shadow:0 8px 32px rgba(0,0,0,.4); }
.img-modal-close { margin-top:12px; background:var(--card); border:none; border-radius:3px; padding:12px; width:100%; cursor:pointer; font-family:var(--font-sans); font-weight:600; font-size:14px; }
.back-btn { background:none; border:none; cursor:pointer; font-size:22px; color:#555; padding:0; line-height:1; }
.page-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
.page-title { font-family:var(--font-display); font-size:20px; font-weight:700; flex:1; }
.empty { text-align:center; padding:48px 24px; color:var(--muted); }
.empty-icon { font-size:52px; margin-bottom:16px; }
.empty-title { font-family:var(--font-display); font-size:18px; font-weight:700; color:#444; margin-bottom:8px; }
.empty-body { font-size:13px; line-height:1.7; }
.filter-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
.filter-label { font-size:10px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:5px; }
.totals-bar { padding:12px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; }
.totals-count { font-size:13px; color:#666; }
.totals-amount { font-family:var(--font-mono); font-size:17px; font-weight:700; }
.install-banner { background:#1a1a1a; color:#f5f0e8; padding:12px 16px; display:flex; align-items:center; gap:12px; font-size:13px; }
.install-banner-text { flex:1; line-height:1.4; }
.install-banner .ib-btn { background:#f5f0e8; color:#1a1a1a; border:none; border-radius:3px; padding:8px 14px; font-family:var(--font-sans); font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; }
.install-banner .dismiss { background:none; color:#666; border:none; cursor:pointer; font-size:18px; padding:4px; }
`;

// ─── PIN Screen ───────────────────────────────────────────────────────────────
function PinScreen({ onUnlock }) {
  const [pin, setPin]           = useState("");
  const [error, setError]       = useState("");
  const [attempts, setAttempts] = useState(() => parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0"));
  const [lockoutEnd, setLockoutEnd] = useState(() => parseInt(localStorage.getItem(LOCKOUT_KEY) || "0"));
  const [now, setNow]           = useState(Date.now());

  // Tick every second to update lockout countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isLockedOut = now < lockoutEnd;
  const lockSecsLeft = Math.ceil((lockoutEnd - now) / 1000);

  const press = (digit) => {
    if (isLockedOut) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    if (next.length === APP_PIN.length) {
      if (next === APP_PIN) {
        localStorage.setItem(ATTEMPTS_KEY, "0");
        localStorage.removeItem(LOCKOUT_KEY);
        sessionStorage.setItem(SESSION_KEY, "true");
        onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        localStorage.setItem(ATTEMPTS_KEY, String(newAttempts));
        if (newAttempts >= MAX_ATTEMPTS) {
          const end = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
          setLockoutEnd(end);
          localStorage.setItem(LOCKOUT_KEY, String(end));
          localStorage.setItem(ATTEMPTS_KEY, "0");
          setAttempts(0);
          setError("");
        } else {
          setError(`Wrong PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? "s" : ""} left.`);
        }
        setTimeout(() => setPin(""), 400);
      }
    }
  };

  const del = () => { setPin(p => p.slice(0, -1)); setError(""); };

  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <div className="pin-screen">
      <div className="pin-logo">🧾</div>
      <div className="pin-title">ReceiptKeep</div>
      <div className="pin-subtitle">Enter your PIN to continue</div>

      {/* Dots */}
      <div className="pin-dots">
        {Array.from({ length: APP_PIN.length }).map((_, i) => (
          <div key={i} className={`pin-dot${i < pin.length ? " filled" : ""}`} />
        ))}
      </div>

      {/* Error / Lockout */}
      <div className="pin-error">
        {isLockedOut
          ? <div className="pin-lockout">🔒 Too many attempts<br/>Try again in {Math.floor(lockSecsLeft/60)}:{String(lockSecsLeft%60).padStart(2,"0")}</div>
          : error}
      </div>

      {/* Keypad */}
      <div className="pin-pad">
        {keys.map((k, i) => (
          k === "" ? <div key={i} className="pin-key empty" /> :
          k === "⌫" ? (
            <button key={i} className="pin-key del" onClick={del} disabled={isLockedOut}>⌫</button>
          ) : (
            <button key={i} className="pin-key" onClick={() => press(k)} disabled={isLockedOut || pin.length >= APP_PIN.length}>{k}</button>
          )
        ))}
      </div>

      {attempts > 0 && !isLockedOut && (
        <div className="pin-attempts">{attempts} failed attempt{attempts !== 1 ? "s" : ""}</div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "true"
  );

  if (!unlocked) return (
    <>
      <style>{CSS}</style>
      <PinScreen onUnlock={() => setUnlocked(true)} />
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <MainApp onLock={() => { sessionStorage.removeItem(SESSION_KEY); setUnlocked(false); }} />
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function MainApp({ onLock }) {
  const [receipts, setReceipts]   = useState(() => loadData());
  const [view, setView]           = useState("dashboard");
  const [filterCat, setFilterCat] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [sortBy, setSortBy]       = useState("date-desc");
  const [form, setForm]           = useState(defaultForm);
  const [errors, setErrors]       = useState({});
  const [toast, setToast]         = useState(null);
  const [deleteId, setDeleteId]   = useState(null);
  const [viewImg, setViewImg]     = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [imgBase64, setImgBase64] = useState(null);
  const [imgMediaType, setImgMediaType] = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [scanStatus, setScanStatus] = useState(null);
  const [scanErrMsg, setScanErrMsg] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const fileRef = useRef();
  const camRef  = useRef();

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  useEffect(() => { saveData(receipts); }, [receipts]);

  function defaultForm() {
    return { store: "", amount: "", category: "Food & Drink", date: today(), notes: "" };
  }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstall(false);
  };

  const handleFile = (file) => {
    if (!file) return;
    setScanStatus(null); setScanErrMsg("");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const [meta, b64] = dataUrl.split(",");
      const mt = meta.match(/:(.*?);/)[1];
      setImgPreview(dataUrl); setImgBase64(b64); setImgMediaType(mt);
      setScanning(true);
      try {
        const extracted = await scanReceiptImage(b64, mt);
        setForm(prev => ({
          store:    extracted.store    || prev.store,
          amount:   extracted.amount   ? String(extracted.amount) : prev.amount,
          category: CATEGORIES.includes(extracted.category) ? extracted.category : prev.category,
          date:     extracted.date     || prev.date,
          notes:    extracted.notes    || prev.notes,
        }));
        setScanStatus("ok");
        showToast("✨ Receipt scanned!");
      } catch (err) {
        setScanStatus("err");
        setScanErrMsg(err.message || "Could not read receipt. Fill in details manually.");
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImgPreview(null); setImgBase64(null); setImgMediaType(null);
    setScanStatus(null); setScanErrMsg("");
  };

  const validate = () => {
    const e = {};
    if (!form.store.trim()) e.store = "Store name required";
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) e.amount = "Enter a valid amount";
    if (!form.date) e.date = "Date required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (!validate()) return;
    const r = {
      id: genId(), store: form.store.trim(),
      amount: parseFloat((+form.amount).toFixed(2)),
      category: form.category, date: form.date,
      notes: form.notes.trim(), image: imgPreview || null, createdAt: Date.now(),
    };
    setReceipts(prev => [r, ...prev]);
    setForm(defaultForm()); setErrors({}); clearImage();
    showToast("Receipt saved!"); setView("dashboard");
  };

  const handleDelete = (id) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
    setDeleteId(null); showToast("Receipt deleted", "error");
  };

  const goAdd = () => { setForm(defaultForm()); setErrors({}); clearImage(); setView("add"); };

  // Derived
  const thisMonth  = today().slice(0, 7);
  const totalAll   = receipts.reduce((s, r) => s + r.amount, 0);
  const monthTotal = receipts.filter(r => r.date.startsWith(thisMonth)).reduce((s, r) => s + r.amount, 0);
  const months     = [...new Set(receipts.map(r => r.date.slice(0, 7)))].sort().reverse();
  const filtered   = receipts
    .filter(r => filterCat === "All" || r.category === filterCat)
    .filter(r => filterMonth === "All" || r.date.startsWith(filterMonth))
    .sort((a, b) => {
      if (sortBy === "date-desc")   return new Date(b.date) - new Date(a.date);
      if (sortBy === "date-asc")    return new Date(a.date) - new Date(b.date);
      if (sortBy === "amount-desc") return b.amount - a.amount;
      return a.amount - b.amount;
    });
  const totalFiltered = filtered.reduce((s, r) => s + r.amount, 0);
  const byCategory = CATEGORIES.map(cat => ({
    cat, total: receipts.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0),
    count: receipts.filter(r => r.category === cat).length,
  })).filter(c => c.count > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="app">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {deleteId && (
        <div className="modal-bg" onClick={() => setDeleteId(null)}>
          <div className="card modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <div className="modal-title">Delete Receipt?</div>
            <div className="modal-body">This cannot be undone.</div>
            <div className="modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-primary danger" style={{width:"auto",padding:"10px 20px"}} onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {viewImg && (
        <div className="modal-bg" onClick={() => setViewImg(null)}>
          <div className="img-modal-inner" onClick={e => e.stopPropagation()}>
            <img src={viewImg} alt="Receipt" />
            <button className="img-modal-close" onClick={() => setViewImg(null)}>✕ Close</button>
          </div>
        </div>
      )}

      {showInstall && (
        <div className="install-banner">
          <span style={{fontSize:22}}>📲</span>
          <div className="install-banner-text"><strong>Install ReceiptKeep</strong><br/>Add to your home screen</div>
          <button className="ib-btn" onClick={handleInstall}>Install</button>
          <button className="dismiss" onClick={() => setShowInstall(false)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div className="header-inner">
          <div>
            <div className="header-title">🧾 ReceiptKeep</div>
            <div className="header-sub">Track every penny</div>
          </div>
          <button className="lock-btn" onClick={onLock} title="Lock app">🔒</button>
        </div>
      </div>

      {/* ── DASHBOARD ── */}
      {view === "dashboard" && (
        <div className="page">
          <div className="stats-grid">
            <div className="card stat-card">
              <div className="stat-label">Total Spent</div>
              <div className="stat-num">{fmtMoney(totalAll)}</div>
              <div className="stat-sub">{receipts.length} receipt{receipts.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">This Month</div>
              <div className="stat-num">{fmtMoney(monthTotal)}</div>
              <div className="stat-sub">{receipts.filter(r => r.date.startsWith(thisMonth)).length} receipt{receipts.filter(r => r.date.startsWith(thisMonth)).length !== 1 ? "s" : ""}</div>
            </div>
          </div>

          <button className="btn btn-primary" style={{marginBottom:16}} onClick={goAdd}>+ Add Receipt</button>

          {byCategory.length > 0 && (
            <div className="card" style={{padding:16, marginBottom:16}}>
              <div className="section-label">Spending by Category</div>
              {byCategory.map(({ cat, total, count }) => (
                <div className="cat-row" key={cat}>
                  <div className="cat-header">
                    <span className="cat-name">{CATEGORY_ICONS[cat]} {cat}</span>
                    <span className="cat-amount">{fmtMoney(total)}</span>
                  </div>
                  <div className="bar"><div className="bar-fill" style={{width:`${(total/totalAll)*100}%`, background:CATEGORY_COLORS[cat]}} /></div>
                  <div className="cat-sub">{count} receipt{count !== 1 ? "s" : ""} · {((total/totalAll)*100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}

          {receipts.length > 0 ? (
            <div className="card">
              <div style={{padding:"14px 16px 8px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div className="section-label" style={{marginBottom:0}}>Recent Receipts</div>
                <button className="btn btn-outline btn-sm" onClick={() => setView("list")}>View All</button>
              </div>
              <div className="receipt-list">
                {receipts.slice(0, 5).map(r => <ReceiptRow key={r.id} r={r} onImg={setViewImg} />)}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty">
                <div className="empty-icon">🧾</div>
                <div className="empty-title">No receipts yet</div>
                <div className="empty-body">Tap <strong>+ Add Receipt</strong> to get started.<br/>You can scan a photo — AI fills in the details!</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADD RECEIPT ── */}
      {view === "add" && (
        <div className="page">
          <div className="page-header">
            <button className="back-btn" onClick={() => setView("dashboard")}>←</button>
            <div className="page-title">Add Receipt</div>
          </div>

          <div className="card" style={{padding:16, marginBottom:14}}>
            <div className="section-label">📷 Scan Receipt (Optional)</div>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => { handleFile(e.target.files[0]); e.target.value=""; }} />
            <input ref={camRef}  type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e => { handleFile(e.target.files[0]); e.target.value=""; }} />

            {!imgPreview ? (
              <>
                <div className="upload-grid">
                  <button className="upload-btn" onClick={() => camRef.current.click()}>📸 Camera</button>
                  <button className="upload-btn" onClick={() => fileRef.current.click()}>🖼️ Upload</button>
                </div>
                <p className="upload-hint">AI will auto-fill the form from your receipt</p>
              </>
            ) : (
              <>
                <div className="img-preview-wrap">
                  <img className="img-preview" src={imgPreview} alt="Receipt preview" />
                  {scanning && (
                    <div className="scan-overlay">
                      <div className="scan-icon">🔍</div>
                      <div className="scan-text">Reading receipt…</div>
                      <div className="scan-sub">AI is extracting details</div>
                    </div>
                  )}
                </div>
                {scanStatus === "ok"  && <div className="alert alert-success">✅ Details extracted — review below</div>}
                {scanStatus === "err" && <div className="alert alert-error">⚠️ {scanErrMsg}</div>}
                <div style={{display:"flex", gap:8}}>
                  <button className="upload-btn" style={{flex:1}} onClick={() => fileRef.current.click()}>🔄 Replace</button>
                  <button className="btn btn-outline btn-sm" style={{flex:"0 0 auto"}} onClick={clearImage}>✕ Remove</button>
                </div>
              </>
            )}
          </div>

          <div className="card" style={{padding:"20px 16px"}}>
            <div style={{textAlign:"center", paddingBottom:12, borderBottom:"1px dashed var(--input-border)", marginBottom:20}}>
              <div style={{fontSize:11, letterSpacing:".12em", textTransform:"uppercase", color:"var(--muted)", fontWeight:600}}>Receipt Details</div>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:16}}>
              <div className="field">
                <label className="label">Store / Merchant *</label>
                <input className={`input${errors.store ? " err" : ""}`} placeholder="e.g. Walmart, Amazon…"
                  value={form.store} onChange={e => setForm(f => ({...f, store: e.target.value}))} />
                {errors.store && <span className="err-msg">{errors.store}</span>}
              </div>
              <div className="field">
                <label className="label">Amount ($) *</label>
                <input className={`input input-mono${errors.amount ? " err" : ""}`} placeholder="0.00"
                  type="number" min="0.01" step="0.01"
                  value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} />
                {errors.amount && <span className="err-msg">{errors.amount}</span>}
              </div>
              <div className="field">
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Date *</label>
                <input className={`input${errors.date ? " err" : ""}`} type="date"
                  value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
                {errors.date && <span className="err-msg">{errors.date}</span>}
              </div>
              <div className="field">
                <label className="label">Notes (optional)</label>
                <textarea className="input" placeholder="Add any notes…" rows={3} style={{resize:"vertical"}}
                  value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
              </div>
            </div>
            <hr className="dashed" />
            <div className="divider-text">— — — — — — — — — — — —</div>
            <button className="btn btn-primary" onClick={handleSave} disabled={scanning}>
              {scanning ? "Scanning…" : "Save Receipt"}
            </button>
          </div>
        </div>
      )}

      {/* ── LIST ── */}
      {view === "list" && (
        <div className="page">
          <div className="page-header">
            <button className="back-btn" onClick={() => setView("dashboard")}>←</button>
            <div className="page-title">All Receipts</div>
            <button className="btn btn-outline btn-sm" onClick={goAdd}>+ Add</button>
          </div>
          <div className="card" style={{padding:"12px 14px", marginBottom:14}}>
            <div className="filter-grid">
              <div>
                <div className="filter-label">Category</div>
                <select className="input" style={{padding:"7px 10px", fontSize:13}} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                  <option value="All">All</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="filter-label">Month</div>
                <select className="input" style={{padding:"7px 10px", fontSize:13}} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                  <option value="All">All time</option>
                  {months.map(m => <option key={m} value={m}>{new Date(m+"-15").toLocaleDateString("en-US",{month:"long",year:"numeric"})}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="filter-label">Sort</div>
              <select className="input" style={{padding:"7px 10px", fontSize:13}} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="date-desc">Date (newest first)</option>
                <option value="date-asc">Date (oldest first)</option>
                <option value="amount-desc">Amount (highest first)</option>
                <option value="amount-asc">Amount (lowest first)</option>
              </select>
            </div>
          </div>
          {filtered.length > 0 && (
            <div className="card totals-bar" style={{marginBottom:14}}>
              <span className="totals-count">{filtered.length} receipt{filtered.length !== 1 ? "s" : ""}</span>
              <span className="totals-amount">{fmtMoney(totalFiltered)}</span>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="card"><div className="empty">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No receipts found</div>
              <div className="empty-body">Try changing your filters.</div>
            </div></div>
          ) : (
            <div className="card">
              <div className="receipt-list">
                {filtered.map(r => (
                  <ReceiptRow key={r.id} r={r} onImg={setViewImg} showDelete onDelete={() => setDeleteId(r.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom nav */}
      <nav className="bottom-nav">
        <button className={`nav-btn${view==="dashboard"?" active":""}`} onClick={() => setView("dashboard")}>
          <span className="nav-icon">📊</span><span className="nav-label">Dashboard</span>
        </button>
        <button className={`nav-btn${view==="add"?" active":""}`} onClick={goAdd}>
          <span className="nav-icon" style={{fontSize:28}}>+</span><span className="nav-label">Add</span>
        </button>
        <button className={`nav-btn${view==="list"?" active":""}`} onClick={() => setView("list")}>
          <span className="nav-icon">📋</span><span className="nav-label">Receipts</span>
        </button>
      </nav>
    </div>
  );
}

// ─── Receipt Row ──────────────────────────────────────────────────────────────
function ReceiptRow({ r, onImg, showDelete, onDelete }) {
  return (
    <div className="receipt-row">
      {r.image
        ? <img className="row-thumb" src={r.image} alt="" onClick={() => onImg(r.image)} />
        : <div className="row-icon">{CATEGORY_ICONS[r.category]}</div>}
      <div className="row-info">
        <div className="row-name">{r.store}</div>
        <div className="row-meta">
          <span className="row-date">{fmtDate(r.date)}</span>
          <span className="tag" style={{background:CATEGORY_COLORS[r.category]+"22", color:CATEGORY_COLORS[r.category]}}>{r.category}</span>
        </div>
        {r.notes && <div className="row-notes">{r.notes}</div>}
      </div>
      <div className="row-actions">
        <span className="row-amount">{fmtMoney(r.amount)}</span>
        {showDelete && <button className="del-btn" onClick={onDelete}>🗑</button>}
      </div>
    </div>
  );
}
