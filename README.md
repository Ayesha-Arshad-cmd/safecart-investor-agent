# SafeCart Kids — Investor Agent ($0)

An autonomous agent that finds investors for **SafeCart Kids**. It:

1. **Understands the app.** It reads safecartkids.com plus the facts you enter, and writes its own search plan.
2. **Searches** the web and **public LinkedIn profiles** (`site:linkedin.com/in "angel investor" "family tech"` …).
3. **Picks real investors.** AI reads every result and keeps only named investors that fit, and it saves the source link for each one.
4. **Researches** each investor: their website, portfolio, thesis and contact page, plus their public LinkedIn and any public email.
5. **Scores** each investor's fit from 0-100 for SafeCart Kids, with reasons, concerns and the best opening hook.
6. **Writes outreach**: a LinkedIn connection note and DM, plus a 4-email cadence (day 0 / 4 / 10 / 21).
7. **Tracks** everything in a CRM pipeline and reminds you when follow-ups are due.

Nothing is installed on your computer, and nothing needs a credit card. You edit the code on GitHub and Railway runs it.

---

## Deploy it (about 15 minutes, all in the browser)

### Step 1 — Get free keys (no credit card)

| What | Where | Needed? |
|---|---|---|
| **Gemini API key** (AI) | https://aistudio.google.com/apikey → *Create API key* | **Yes** (or Groq) |
| **Groq API key** (backup AI) | https://console.groq.com/keys | Recommended |
| **Tavily API key** (search, 1,000/month free) | https://app.tavily.com | **Strongly recommended** |
| Serper API key (Google results, 2,500 free) | https://serper.dev | Optional extra search |
| Brevo API key (send emails from the app) | https://app.brevo.com → SMTP & API → API keys | Optional |

Without a search key the agent falls back to DuckDuckGo. That needs no key, but it often blocks cloud servers, so add Tavily or Serper.

### Step 2 — Put the code on GitHub

1. Go to https://github.com/new, name the repo `safecart-investor-agent`, choose **Private**, and click **Create repository**.
2. On the new repo page, click **uploading an existing file**.
3. Unzip this project on your computer. Then drag **everything inside the folder** (`server`, `src`, `package.json`, `railway.json`, `index.html`, and the rest) into the upload box and click **Commit changes**.
   - Hidden files such as `.gitignore` may not upload by drag-and-drop. That's fine.

### Step 3 — Deploy on Railway

1. Go to https://railway.com, sign in with GitHub, then click **New Project → Deploy from GitHub repo** and pick `safecart-investor-agent`.
2. Open the service, go to **Variables**, and add:
   ```
   APP_PASSWORD     = any long password you choose
   GEMINI_API_KEY   = your Gemini key
   GROQ_API_KEY     = your Groq key          (optional backup)
   TAVILY_API_KEY   = your Tavily key
   DATA_DIR         = /data
   ```
3. Right-click the service (or use the **+** / *Command palette*), choose **Add Volume**, and set the mount path to **`/data`**. This keeps your CRM safe across redeploys.
   If your plan doesn't allow a volume, the app still works: your browser keeps a copy, and you can **Export CSV** at any time.
4. Under **Settings → Networking**, click **Generate Domain**.
5. Wait for the deploy to turn green, then open the domain and enter your `APP_PASSWORD`.

The build and start commands are already set in `railway.json` (`npm run build` and `npm start`).

---

## Using it

**Who it looks for:** only people based in your business's country (from the location in *Your App*: "Chandler, AZ" → United States, with a bonus for Arizona). Anyone who wants money from you **before** anything happens (retainers, application, pitch or membership fees) is filtered out of your lists and never emailed. The list tab shows how many were hidden and lets you look at them. Fundraising experts paid only from results (success fee) are preferred.

**Emails** follow the two model emails in `src/data/emailTemplates.ts`: the investor email and the fundraising-expert email (5% success fee, no upfront fees, up to 0.5% equity). To change the terms, edit `EXPERT_TERMS` in that file.

**Investors or fundraising experts?** Use the **Looking for** dropdown at the top. *Investors* finds people and funds who could invest. *Fundraising experts* finds people who can help you raise (fundraising consultants and advisors, pitch-deck and financial-model experts, fractional CFOs, startup lawyers, boutique bankers). Each has its own list, scores and emails, and you can switch any time. Settings (auto-email, limits) apply to both lists.

1. **Your App tab:** check the facts, add the raise amount, real traction and the founder's name, then click **Analyse with AI**.
2. Click **Find investors**, pick how many (50 / 100 / 150 / 200) and click **Start**.
   - The agent quick-scans everyone it finds and adds them to your list straight away.
   - It then deep-researches the best ones (score 50+, up to 40 per run — change this in Settings → Deep research).
   - You can close the window: the run keeps going on the server, survives restarts, and has **Pause / Resume**.
   - Click **Start next run** any time: it never repeats a search it already did, so you get *new* investors.
   - People marked **Quick scan** can be upgraded any time with **Research deeply**.
3. **Scores tab:** see why each investor fits or doesn't.
4. **Investors tab:** table or board view, statuses, follow-up dates and CSV export.
5. **Outreach tab:**
   - **Automatic email** (after the Gmail setup below): every deep-researched investor at or above your score gets email 1, then follow-ups on day 4 / 10 / 21, inside your daily limit. When they reply, their follow-ups stop by themselves. Pause any single investor with one click.
   - **LinkedIn today:** your daily list of connection requests. Click *Open profile* (the note is copied for you), paste it into "Add a note", then *Mark request sent*.
   - **Accepted:** when LinkedIn emails you "… accepted your invitation", the agent spots it and puts that investor here. Click *Open profile & copy message*, paste, send, *Mark messaged*.

## Automatic email (Gmail script, $0, about 10 minutes)

Railway's free plan blocks normal email, so a tiny free script inside your own Google account does the sending. Emails go out from your real Gmail and show in your Sent folder.

1. Sign in to the Gmail account you want to send from. Open **https://script.google.com** → **New project**.
2. Delete what's there, paste the whole of `google-apps-script/Code.gs`.
3. At the top, change `CHANGE-ME-to-a-long-random-password` to your own long password. Click **Save**.
4. **Deploy → New deployment →** gear icon → **Web app**. *Execute as:* **Me**. *Who has access:* **Anyone**. Click **Deploy**.
5. Click **Authorize access**, pick your account → *Advanced* → *Go to project (unsafe)* → **Allow**. (It says "unsafe" only because you wrote the script yourself and Google hasn't reviewed it.)
6. Copy the **Web app URL** (ends with `/exec`).
7. In Railway → your service → **Variables**, add `GMAIL_SCRIPT_URL` = that URL and `GMAIL_SCRIPT_SECRET` = your password from step 3. Railway redeploys.
8. In the app: **Settings → Automatic email** → tick it, set your minimum score (50), emails per day, and your **company postal address** (the law requires it in cold emails). Save.
9. LinkedIn: in LinkedIn → Settings → Notifications, keep **email** notifications on for "Invitation accepted", so the agent can see who accepted.

If you change the script later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

### Updating the Gmail script (needed for Google Sheets and the Investor / Expert tags)

1. Open your project on **https://script.google.com**, select all the code and delete it, then paste the new `google-apps-script/Code.gs`.
2. Put **your own** SECRET back on the `const SECRET = '…'` line (the same one as in Railway). Click **Save**.
3. Pick **doGet** in the function list and click **▶ Run** → **Review permissions** → your account → **Advanced** → **Go to … (unsafe)** → **Allow**. Google asks again because the script can now create Google Sheets.
4. **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy.** The URL stays the same, so nothing changes in Railway.

What it adds:
- **Open in Google Sheets** (Investors / Experts tab and Outreach tab) creates a Google Sheet of the list in your Google Drive and opens it. Use **File → Download** in Sheets if you need an Excel file.
- Every email the agent sends gets a Gmail label, **Investor** or **Fundraising Expert**. Replies stay in the same thread, so they carry the label too, and the agent also labels any reply it finds.

### About LinkedIn

LinkedIn has no free API for searching people, and logging in with bots gets accounts banned. So the agent finds **public** profiles through search engines (the same results you'd see on Google), and you send the note yourself with one click. Your LinkedIn account is never touched.

### Honesty guardrails

- The AI is told never to invent traction, metrics, investors, emails or portfolio companies.
- An email is only saved if it was actually published on that investor's own website.
- Every investor keeps its **source links** in the dossier, under *Sources & website data*. Glance at them before you send anything.

---

## Free-tier limits (so nothing surprises you)

- **Gemini free tier:** limited requests per minute and per day. The agent automatically falls back to Groq (and OpenRouter or Hugging Face if you add those keys). On Google's free tier, prompts may be used to improve Google's products, so don't paste confidential data into the "Anything else" box.
- **Serper:** 2,500 free searches (one time). A 100-investor run uses about 25-40 searches. Tavily: 1,000/month.
- **Groq free:** about 1,000 AI requests a day. A 100-investor run uses about 60-90 (quick scans are 10 per request; each deep research is 1-2). If a limit is hit, the run waits and carries on.
- **Gmail:** about 100 emails a day on a normal Gmail (1,500 on Google Workspace). Start with 20-25 a day so your address stays trusted.
- **LinkedIn (free account):** about 100 connection requests a week, and only a few personalised notes a month. Keep "LinkedIn requests per day" around 15-20. The app never logs in to LinkedIn for you — automation tools that do get accounts restricted.
- **Railway Free plan:** small CPU and RAM, which is plenty for this app. Railway blocks SMTP on free plans, so email sending uses Brevo's HTTPS API or your own Gmail.

## Later: other apps

Everything is app-agnostic. To use it for another app, change the profile in Tab 1 (name, website, facts) and click **Analyse with AI**. Proper multi-app workspaces and APK and screenshot intake are the next phases.

## Project layout

```
server/            Node backend, zero runtime dependencies
  index.ts         HTTP server + API routes + serves the built frontend
  ai.ts            Gemini / Groq / OpenRouter / HF client with automatic fallback
  search.ts        Tavily / Serper / DuckDuckGo search (incl. public LinkedIn profiles)
  reader.ts        Website reader (+ free Jina Reader fallback)
  agent.ts         The agent: analyse → discover → research → score → outreach
  store.ts         JSON-file CRM database (DATA_DIR)
  email.ts         Sends through the Gmail helper (or Brevo as a backup)
  gmail.ts         Talks to the Gmail helper script
  campaign.ts      Big runs (100-200 investors), resumable, never repeats searches
  automation.ts    Auto-email + follow-ups + reply / LinkedIn-accepted detection
google-apps-script/Code.gs   The free Gmail helper you paste into script.google.com
src/               React frontend (your original UI, now wired to the real backend)
```

## Test on your computer in VS Code (before deploying)

You need **Node.js 20 or newer** (free): https://nodejs.org → download **LTS** → install. Then restart VS Code.

1. Unzip the project. In VS Code, use **File → Open Folder** and pick `safecart-investor-agent`.
2. Open a terminal with **Terminal → New Terminal**, then run:
   ```
   npm install
   ```
3. Copy `.env.example` to a new file called **`.env`** in the same folder. Fill in at least `GEMINI_API_KEY` (and ideally `TAVILY_API_KEY`). `.env` is git-ignored, so your keys never go to GitHub.
4. Build and start it, exactly as Railway will:
   ```
   npm run local
   ```
   Open **http://localhost:8080** in your browser. Stop the server with `Ctrl + C`.

**Hot-reload mode (for editing code):** use two terminals.
```
npm run dev:server     # terminal 1 – backend on :8080
npm run dev            # terminal 2 – UI on http://localhost:3000 (auto-refreshes on save)
```
Local data is saved in the `data/` folder (git-ignored).
