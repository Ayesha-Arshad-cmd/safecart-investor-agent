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

1. **Tab 1 · SafeCart Kids Brain:** check the facts, add the raise amount, real traction and the founder's name, then click **Analyse with AI**.
2. Click **Run Agent**, choose how many investors to research (start with 5-10), and click **Start agent**. A run takes a few minutes. You can close the window and it keeps running.
3. **Tab 3 · AI Scoring:** see why each investor fits or doesn't.
4. **Tab 4 · CRM Pipeline:** table or kanban view, with statuses, follow-up dates and CSV export.
5. **Tab 5 · Outreach & Follow-ups:**
   - **LinkedIn:** click *Open profile* (or *Find on LinkedIn*), then *Copy note*, paste it into LinkedIn's "Add a note", and click *Mark request sent*.
   - **Email:** use *Open in Gmail* to send from your own account, then click *Mark as sent*. The next follow-up date is scheduled automatically.
   - When someone answers, click **They replied** to stop their cadence.
   - The **Due** filter shows whose follow-up is due today.

### About LinkedIn

LinkedIn has no free API for searching people, and logging in with bots gets accounts banned. So the agent finds **public** profiles through search engines (the same results you'd see on Google), and you send the note yourself with one click. Your LinkedIn account is never touched.

### Honesty guardrails

- The AI is told never to invent traction, metrics, investors, emails or portfolio companies.
- An email is only saved if it was actually published on that investor's own website.
- Every investor keeps its **source links** in the dossier, under *Sources & website data*. Glance at them before you send anything.

---

## Free-tier limits (so nothing surprises you)

- **Gemini free tier:** limited requests per minute and per day. The agent automatically falls back to Groq (and OpenRouter or Hugging Face if you add those keys). On Google's free tier, prompts may be used to improve Google's products, so don't paste confidential data into the "Anything else" box.
- **Tavily:** 1,000 credits a month. One run of 10 investors uses roughly 30-40 searches.
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
  email.ts         Optional Brevo sending
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
