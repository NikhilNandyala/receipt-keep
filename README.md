# 🧾 ReceiptKeep

A free, private receipt tracker with PIN lock protection.
Works as a **browser site** and installs as a **phone app** (PWA).

---

## Security

The app is protected by a PIN lock screen. Features:
- **5-attempt limit** before a 5-minute lockout
- **Session-based unlock** — re-locks when you close the browser tab
- **Lock button** (🔒) in the header to manually lock at any time
- Your data stays in your browser's localStorage — nothing is sent to any server except when using the AI scan feature

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_ANTHROPIC_API_KEY=your_key_from_console.anthropic.com
VITE_APP_PIN=your_chosen_pin
```

> **Important:** Change `VITE_APP_PIN` from the default `1234` to something only you know.

### 3. Run locally
```bash
npm run dev
```

---

## Deploy to Vercel (Free)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Add **Environment Variables** in Vercel's dashboard:
   - `VITE_ANTHROPIC_API_KEY` → your Anthropic key
   - `VITE_APP_PIN` → your secret PIN
4. Click **Deploy**

> Your PIN is stored as a Vercel environment variable — it is **not** visible in your code or Git history.

---

## Install as Phone App (PWA)

**iPhone (Safari):** Share → Add to Home Screen → Add

**Android (Chrome):** Menu → Add to Home Screen, or tap the Install banner

---

## Customisation

| What              | Where                          |
|-------------------|--------------------------------|
| PIN length        | Change `APP_PIN` length in `.env.local` (any length works) |
| Lockout attempts  | `MAX_ATTEMPTS` constant in `App.jsx` |
| Lockout duration  | `LOCKOUT_MINUTES` constant in `App.jsx` |
| Currency          | `fmtMoney()` function in `App.jsx` |
| Categories        | `CATEGORIES` array in `App.jsx` |
| App name          | `manifest` section in `vite.config.js` |
