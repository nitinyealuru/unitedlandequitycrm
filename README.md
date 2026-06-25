# United Land Equity — CRM

A pipeline CRM for tracking land-flipping leads from outbound text outreach through closing,
with EMD risk tracking and outreach stats.

This is a static React app (Vite) that stores all data in Supabase (a free hosted Postgres
database), so your leads sync across your phone, laptop, or any device you log in from.

---

## 1. Create your Supabase project (~5 minutes)

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is plenty for this).
2. Click **New project**. Pick any name/region, set a database password (save it somewhere).
3. Once the project finishes setting up, go to the **SQL Editor** tab (left sidebar).
4. Click **New query**, paste in the entire contents of `supabase_schema.sql` (included in this
   folder), and click **Run**. This creates your `leads`, `emds`, and `outreach_log` tables.
5. Go to **Project Settings → API** (left sidebar, gear icon).
   - Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - Copy the **anon public** key (a long string under "Project API keys")

## 2. Connect the app to your Supabase project

1. In this project folder, copy `.env.example` to a new file called `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and paste in your Project URL and anon key from step 1:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. **Never commit this `.env` file or share it publicly** — anyone with these values can read
   and write your data, since this app doesn't have a login system (it's built for solo use).

## 3. Run it locally to confirm it works

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). You should see an empty CRM —
add a test lead to confirm it saves (refresh the page; the lead should still be there).

## 4. Deploy it so you can use it from your phone

### Option A: Vercel (recommended, free)

1. Push this project to a GitHub repo (create a new repo on github.com, then):
   ```bash
   git init
   git add .
   git commit -m "Initial CRM"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com), sign up with your GitHub account.
3. Click **Add New → Project**, select your repo.
4. Before deploying, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy**. After a minute you'll get a live URL like
   `united-land-equity-crm.vercel.app` — open it on your phone, bookmark it or add it to your
   home screen (Safari/Chrome → Share → Add to Home Screen) so it feels like an app.

### Option B: Netlify (same idea, matches your original screenshot's hosting)

1. Push to GitHub as above.
2. Go to [netlify.com](https://netlify.com), sign up, click **Add new site → Import an
   existing project**, connect your repo.
3. Build command: `npm run build` — Publish directory: `dist`
4. Under **Site settings → Environment variables**, add the same two `VITE_SUPABASE_*` values.
5. Deploy. You'll get a `your-site-name.netlify.app` URL.

## 5. Day-to-day use

Once deployed, just open the URL on whatever device you're using — your phone while texting
leads, your laptop while reviewing the pipeline. Everything saves to Supabase instantly and
syncs across devices.

## Notes on this being a single-user app

There's no login screen — anyone with your live URL can open and edit the CRM. That's fine as
long as you don't share the link. If you ever bring on a partner or VA and want real
access control, that's a bigger change (Supabase Auth + per-user permissions) — just let me
know when you're there and we can add it.

## Project structure

- `src/App.jsx` — the entire CRM UI and logic
- `src/supabaseClient.js` — connects to your Supabase project using the `.env` values
- `supabase_schema.sql` — run once in Supabase to create your tables
- `.env` — your private Supabase credentials (not committed to git)
