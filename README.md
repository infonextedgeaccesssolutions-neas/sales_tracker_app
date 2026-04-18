# PCORP Sales Tracker — Web + Mobile App

Real-time sales tracker. Edit on any device and all users see changes instantly.

---

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | React 18 |
| Real-time DB | Supabase (free tier) |
| Charts | Recharts |
| Excel | SheetJS (xlsx) |
| Web deploy | Vercel (free) |
| Mobile | Capacitor → iOS + Android |

---

## STEP 1 — Set up Supabase (5 minutes, free)

1. Go to **https://supabase.com** → Sign up (free)
2. Click **New project** → name it `pcorp-sales-tracker` → set a password → Create
3. Wait ~2 minutes for it to provision
4. Go to **SQL Editor** → **New query**
5. Paste the entire contents of `schema.sql` and click **Run**
6. Go to **Settings → API**
7. Copy:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon public** key → long string starting with `eyJ...`

---

## STEP 2 — Configure the app

In the project folder, create a file called `.env.local`:

```
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

Replace with your actual values from Step 1.

---

## STEP 3 — Install and run locally

```bash
npm install
npm start
```

Open http://localhost:3000 — the app loads and syncs with Supabase.

**Test real-time:** Open the app in two browser tabs. Edit a cell in one tab — it updates in the other instantly.

---

## STEP 4 — Deploy to web (Vercel, free)

```bash
npm install -g vercel
vercel
```

Follow prompts (log in / sign up). Your app gets a live URL:
```
https://pcorp-sales-tracker.vercel.app
```

**Add environment variables in Vercel:**
1. Go to vercel.com → your project → Settings → Environment Variables
2. Add `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`
3. Redeploy: `vercel --prod`

---

## STEP 5 — Build mobile app (iOS + Android)

### Prerequisites
- **iOS**: Mac with Xcode installed (free from App Store)
- **Android**: Android Studio installed (free from developer.android.com)

### Build for both platforms

```bash
npm install
npm run cap:ios      # Opens Xcode — run on iPhone simulator or real device
npm run cap:android  # Opens Android Studio — run on emulator or real device
```

### Publish to App Store / Play Store
- **iOS**: In Xcode → Product → Archive → Distribute App
- **Android**: In Android Studio → Build → Generate Signed Bundle

---

## How real-time sync works

```
Phone A edits a cell
       ↓
   Supabase DB
       ↓
Phone B + Web browser update instantly (< 1 second)
```

- If internet is unavailable → app falls back to **localStorage** automatically
- When connection returns → data shows "Offline mode" badge in header
- All edits are always saved locally as a backup

---

## Features

| Feature | How |
|---|---|
| Click/tap any blue cell to edit | Inline editing |
| Status auto-updates | Based on Win Rate + Revisions formula |
| Import Excel | ⬆ Import button — supports .xlsx, .xls, .csv |
| Export Excel | ⬇ Export button — downloads 2-sheet Excel file |
| Add new proposal | + Add proposal button |
| Delete proposal | ✕ button on each row |
| Filter by status | Pill buttons above table |
| Tap KPI cards | Jumps to Tracker filtered by that status |

---

## Status logic (auto-calculated)

| Win Rate | Revisions | Status |
|---|---|---|
| = 1.0 (100%) | any | **Win** 🟢 |
| ≥ 0.6 (60%+) | any | **Negotiation** 🟡 |
| > 0 | any | **On-bidding** 🔵 |
| = 0 | > 0 | **Revision** 🟠 |
| = 0 | = 0 | **Loss** 🔴 |

---

## File structure

```
sales-tracker-app/
├── src/
│   ├── App.js          ← Main app (all UI + logic)
│   ├── supabase.js     ← Supabase client
│   └── index.js        ← React entry point
├── public/
│   └── index.html
├── schema.sql          ← Run this in Supabase SQL Editor
├── capacitor.config.json
├── package.json
├── .env.example        ← Copy to .env.local and fill in keys
└── README.md
```
