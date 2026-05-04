# 🧾 ReceiptKeep

A free, privacy-first receipt storage and expense tracker.
Works as a **browser website** and installs as a **phone app** (PWA) on iPhone & Android.

---

## Features

- 📷 Snap or upload a receipt photo — AI fills in the details automatically
- 📊 Dashboard with spending totals and category breakdown
- 🔍 Filter by category and month, sort by date or amount
- 💾 Data saved locally on your device (no account needed)
- 📱 Installable as a home screen app on any phone

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Add your Anthropic API key

```bash
cp .env.example .env.local
```

Open `.env.local` and replace `your_api_key_here` with your key from [console.anthropic.com](https://console.anthropic.com).

> You get $5 free credit to start — enough for thousands of receipt scans.

### 3. Run locally

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## Deploy (Free)

### Option A — Vercel (recommended, 2 minutes)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. In the **Environment Variables** section, add:
   - Key: `VITE_ANTHROPIC_API_KEY`
   - Value: your API key
4. Click **Deploy** — you get a live `https://your-app.vercel.app` URL

### Option B — Netlify

1. Run `npm run build` — this creates a `dist/` folder
2. Go to [netlify.com/drop](https://app.netlify.com/drop)
3. Drag and drop the `dist/` folder
4. Add `VITE_ANTHROPIC_API_KEY` in Site Settings → Environment Variables
5. Redeploy

---

## Install as a Phone App (PWA)

Once deployed to a live URL:

**iPhone (Safari):**
1. Open the URL in Safari
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add** — the app appears on your home screen!

**Android (Chrome):**
1. Open the URL in Chrome
2. Tap the **⋮ menu** → **Add to Home screen**
3. Or tap the **Install** banner that appears automatically

The app then runs full-screen with no browser bar, just like a native app.

---

## Project Structure

```
receipt-keep/
├── public/
│   ├── favicon.svg
│   ├── apple-touch-icon.png   ← iPhone home screen icon
│   └── icons/
│       ├── icon-192.png       ← Android icon
│       └── icon-512.png       ← Splash screen icon
├── src/
│   ├── main.jsx               ← React entry point
│   ├── index.css              ← Global reset
│   └── App.jsx                ← Main app (all components)
├── .env.example               ← Copy to .env.local and add your key
├── .gitignore
├── index.html
├── package.json
└── vite.config.js             ← Vite + PWA config
```

---

## Customisation Tips

- **Currency**: Search for `£` in `App.jsx` and replace with your currency symbol
- **Categories**: Edit the `CATEGORIES` array at the top of `App.jsx`
- **App name**: Update `name` and `short_name` in `vite.config.js` under the PWA manifest
- **Icons**: Replace the PNGs in `public/icons/` with your own 192×192 and 512×512 images

---

## Privacy

All receipt data is stored in your browser's `localStorage` — nothing is sent to any server except when you use the AI scan feature (which sends the image to Anthropic's API). No account, no tracking.
