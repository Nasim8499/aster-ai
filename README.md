# Aster

**A minimal AI assistant with a real Agent mode.** Chat is instant and conversational. Switch one control to **Agent** and it plans, researches, builds and shows a live preview of the actual deliverable — download it as Markdown, HTML, PDF or DOCX.

Built for this workspace as a **Vite + React + TypeScript + Tailwind client** with a **Next.js App Router backend** in `server/` (the workspace's build tooling is Vite; the server is deploy-ready).

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # preview the built bundle
```

### Sign in

| Account | Email | Password | Role |
| --- | --- | --- | --- |
| Admin | `admin@aster.ai` | `aster123` | Admin (dashboard) |
| Demo user | `demo@aster.ai` | `demo123` | Member, Free plan |

You can also create an account, use the simulated **Continue with Google** flow, or press **User demo / Admin demo**. Accounts, sessions, chats, runs and usage are stored locally in this browser under the `aster:` namespace. The production flow is documented below.

---

## The two modes

The whole app is one ChatGPT-style surface: a collapsible sidebar of conversations, a centered thread, and a composer with a **Chat / Agent** switch. Sending a message creates or continues a conversation; Agent runs render inline in the thread.

### Chat
- Centered ChatGPT-style conversation, streaming responses, markdown, tables, copyable code blocks.
- Copy message, stop generation, regenerate, new chat, rename, pin, delete, search.
- Conversation history in the sidebar; model selector and provider settings in Settings.
- **Chat never runs an agent or claims a live browser action.**

### Agent — live web browsing
1. Switch the composer to **Agent** and describe a research task (or pick an example).
2. A **browser card** appears inline in the thread, exactly like a ChatGPT tool call:
   - six-step plan (understand → search → open → read → compare → answer) with live status;
   - **live viewport** with macOS chrome, current URL, favicon, loading shimmer and page-title overlay;
   - **real screenshot** of every page the agent opens, plus a sources rail;
   - timestamped navigation/network logs;
   - controls: pause/resume (reader engine), stop, re-run, expand, reload screenshot, open page in a new tab.
3. The assistant answer streams in below the card with numbered citations, a sources list, copy and `.md` / `.pdf` / `.html` export.
4. Continue in the composer to ask a follow-up; the agent keeps the conversation context.

The preview is never a mockup: the screenshot belongs to the URL shown in the chrome. Use **Agent** for live research and **Chat** for everything else.

---

## Live browsing (Agent mode) — your real Chrome

Agent mode is powered by a **Python + Browser Use backend** in `backend/`. It launches your installed Chrome with your own profile, runs the open-source agent, and streams a live screenshot + thought/action/URL timeline over SSE.

```bash
# Fully close Chrome first!
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # add your LLM key
uvicorn main:app --port 8000
```

Then **Settings → Real Chrome agent → Agent API URL** = `http://127.0.0.1:8000` and press **Test agent**.
See [`backend/README.md`](backend/README.md) for the full API, screenshots hook and troubleshooting.

> ⚠️ **Fully close Chrome before starting.** Only one process can use a profile; the agent takes over your real browser.

### Browser engines

Agent mode is a real browsing agent, not a simulation. The composer's **Agent** toggle switches the same ChatGPT-style thread into a browsing run and streams the work inline — plan, live logs, real screenshots and citations.

### Two engines

| Engine | What it does | Needs a backend? |
| --- | --- | --- |
| **Real Chrome** (default) | `backend/` runs `browser_use.Agent` on `Browser.from_system_chrome(profile_directory="Default")`, captures `ScreenshotEvent(full_page=False)` in `on_step_end`, and streams `history.urls()` / `history.model_thoughts()` | Yes — Python 3.11 + Chrome |
| **Live reader** (fallback) | Searches DuckDuckGo through the Jina Reader, opens each result, extracts real page text, captures a real screenshot through Microlink | No — works in the browser |

Both write the same event stream into `BrowseCard` (`src/components/BrowseCard.tsx`):

1. **Plan** — understanding → searching → opening → reading → comparing → answering, with live status per step.
2. **Live viewport** — macOS browser chrome, the current URL, a favicon, loading shimmer, reload screenshot, open-in-new-tab, expand, and a page title overlay. The screenshot is the actual page the agent opened.
3. **Sources rail** — every page read, with its live title and host.
4. **Logs** — timestamped network/navigation/read events.
5. **Controls** — pause, resume, stop, re-run, and “Ask a follow-up”.
6. **Answer** — markdown with numbered citations `[1] [2]`, a sources list, copy, and `.md` / `.pdf` / `.html` export.

### Real Chrome agent API

The Python service (`backend/main.py`) exposes `/health`, `/api/agent/start`, `/api/agent/stream/{id}`
(SSE), `/api/agent/status/{id}`, `/api/agent/result/{id}` and `/api/agent/{pause|resume|stop}/{id}`.
The UI also controls it from **Settings → Real Chrome agent** (URL, optional access token, max steps)
with a live **Test agent** probe.

SSE event shapes consumed by the UI:

```
{ type: "screenshot", data: "data:image/jpeg;base64,…", url, step }
{ type: "thought",    text, step }
{ type: "action",     text, step }
{ type: "url",        url, step }
{ type: "result",     text }
{ type: "status",     status: "running|paused|stopped|done|error" }
{ type: "error",      message, hint }
{ type: "done" }
```

### Why the reader engine works without keys

- `https://r.jina.ai/<url>` returns the real page markdown (verified CORS).
- `https://api.microlink.io/?url=…&screenshot` returns a real screenshot URL (verified CORS).
- The answer is **extractive**: statements are quoted from the pages actually fetched, with citations, so the agent never invents what it did not read.

---

## Architecture

```
src/
  App.tsx                 auth gate → hero / app shell + route transitions
  pages/
    AuthPage.tsx          email+password, simulated Google, demo accounts
    HomePage.tsx          centered hero: name, tagline, composer, suggestions
    ChatPage.tsx          conversation, streaming, markdown, regenerate
    WorkspacePage.tsx     ChatGPT-style thread, inline browsing card, composer
    PlansPage.tsx         plans, usage meters, simulated billing
    SettingsPage.tsx      profile, theme, model provider, data controls
    AdminPage.tsx         accounts, usage, backend status
  components/
    BrowseCard.tsx        live browser preview, plan, logs, sources, exports
    AppShell.tsx          ChatGPT-style sidebar, search, history, usage, account
    Composer.tsx          Chat/Agent mode switcher + prompt input
    Markdown.tsx          safe markdown renderer + code copy
    ui.tsx                buttons, segmented, switch, modal, toast, logo
  lib/
    agent.ts              plan builder, artifact generators, AgentEngine
    chat.ts               streaming chat (server proxy → demo fallback)
    export.ts             MD / HTML / PDF (jsPDF) / DOCX (docx)
    store.tsx             auth, conversations, runs, projects, usage, settings
    types.ts              DB-shaped data model, plans, prompts
server/                   Next.js App Router backend (deploy separately)
  …                       Next.js API helpers (chat, agent, projects, auth)
  app/api/chat            streaming Gemini proxy (modular provider gateway)
  app/api/agent/start     create a run with a visible plan
  app/api/agent/status    progress + steps
  app/api/agent/result    artifact + completion
  app/api/projects        list / create projects
  app/api/auth/*          password login, logout, session
  lib/models.ts           ModelProvider interface + Gemini and demo providers
  lib/adminAuth.ts        signed admin cookie helpers
  middleware.ts           protects /api/agent, /api/chat, /api/projects
backend/                  Python Browser Use backend for your real Chrome
  main.py                 FastAPI routes + SSE
  runner.py               Chrome launch, agent.run, ScreenshotEvent, history
  requirements.txt         Python dependencies
  .env.example            LLM + Chrome + server configuration
db/schema.sql             PostgreSQL schema + RLS + usage rollups
wrangler.toml             Cloudflare Workers (OpenNext) config
open-next.config.ts       OpenNext adapter config
```

### Agent workflow logic (`src/lib/agent.ts`)
- `detectIntent(task)` → landing page · visa · research · business plan · workflow · general.
- `createRun()` builds six `AgentStep`s, two of which require approval.
- `AgentEngine` advances the run, streams logs, mutates the artifact at each phase, pauses/resumes/stops, and waits on `approve()`/`reject()` promises.
- `buildArtifact(task, intent, level)` returns `{ kind, title, content, files, outline }`; level 0→5 means the preview genuinely grows as the agent works.
- Exporters consume that artifact, so all four formats always match what is on screen.

### Sample task flow
`"Create a landing page for my visa consultancy agency"` → intent `landing` → brand derived (VisaHOBe for visa briefs) → plan created → research copy written → approval gate → HTML assembled from real sections with responsive CSS → review pass → iframe shows the finished page; `index.html`, `copy.md` and `README.md` available; download as HTML/PDF/MD/DOCX; the run is stored in Projects.

---

## Backend API (Next.js App Router, `server/`)

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/chat` | POST | Chat completion; `?stream=1` returns SSE |
| `/api/agent/start` | POST / GET | Create a run / list runs |
| `/api/agent/status?runId=` | GET | Status, progress and steps |
| `/api/agent/result?runId=` | GET / POST | Artifact / mark complete |
| `/api/projects` | GET / POST | Projects derived from runs |
| `/api/auth/login` | POST | Admin password → signed httpOnly cookie |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/session` | GET | Session probe |

- `server/lib/models.ts` exposes a `ModelProvider` interface; Gemini is implemented, the demo provider is the fallback, and new vendors can be registered without touching routes.
- Every sensitive route is gated by `server/middleware.ts`, which validates the signed `vm_admin`-style cookie. API keys live only in environment variables.
- The in-memory run store is a reference implementation; swap it for `db/schema.sql` to persist runs, steps, logs, artifacts and usage.

### Environment

```bash
ADMIN_PASSWORD=change-me
GEMINI_API_KEY=            # live answers, optional
DATABASE_URL=              # Postgres for durable runs
MODEL_PROVIDER=gemini
```

Copy `.env.example` → `.env.local`, and `.dev.vars.example` → `.dev.vars` for Workers previews. Never commit either.

---

## Database

`db/schema.sql` is a complete PostgreSQL schema:

`users`, `sessions`, `oauth_accounts`, `conversations`, `messages`, `agent_runs`, `agent_steps`, `agent_logs`, `artifacts`, `artifact_files`, `projects`, `subscriptions`, `usage_events`, plus a `usage_this_month` rollup view, `updated_at` triggers, and row-level security policies.

The client's local repository is shaped the same way (`owner`/`user_id`, run status enums, step states, artifact files), so migrating to these tables is a repository swap inside `src/lib/store.tsx`.

---

## Authentication flow

1. `POST /api/auth/login` validates `ADMIN_PASSWORD` and sets a signed, httpOnly, SameSite=Lax cookie (12h, or 30 days when “remember” is used).
2. Middleware rejects every `/api/agent/*`, `/api/chat/*` and `/api/projects/*` request without a valid cookie.
3. In this local build, accounts are hashed with SHA-256 and stored per browser; Google sign-in is simulated and clearly labelled. Add a real OAuth client and the `oauth_accounts` table for production.

---

## Usage limits & plans

| Plan | Chats / month | Agent runs / month |
| --- | --- | --- |
| Free | 30 | 5 |
| Pro ($20) | 2,000 | 200 |
| Team ($49) | 10,000 | 1,000 |

Limits are enforced before a send/run, usage is tracked per account per month, and the Plans page shows live meters. **Billing is simulated** — plan changes are immediate and no card is charged. Admin dashboard: `/admin` (Admin role only) for accounts, plan assignment, run stats and backend status.

---

## Deployment

### 1. Client (this bundle)
`npm run build` → deploy `dist/` to Vercel, Netlify, Cloudflare Pages or any static host. Set `BACKEND` as your proxy origin in **Settings → API base URL**.

### 2. Backend (Next.js App Router)
Deploy `server/` as a Next.js 14/15 project (copy `app/`, `lib/`, `middleware.ts` into it), set the environment variables above, then point the client's API base URL at that origin (or host both on the same domain so `/api/...` resolves directly).

### 3. Cloudflare Workers (OpenNext)

```bash
npm install -D @opennextjs/cloudflare wrangler# if not already present
npx opennextjs-cloudflare build --config ./wrangler.toml
npx wrangler deploy --config ./wrangler.toml

# secrets
wrangler secret put ADMIN_PASSWORD
wrangler secret put GEMINI_API_KEY
wrangler secret put DATABASE_URL

# custom domain: uncomment the `routes` block in wrangler.toml
```

`wrangler.toml` sets `compatibility_flags = ["nodejs_compat"]`, observability and an assets binding. `open-next.config.ts` is ready for KV/R2 caching when you add server-rendered pages.

---

## Every control does something

- Mode toggle switches the interface and the submit behaviour; Agent exits to its workspace with a live run.
- Sidebar: new chat, search, rename, pin, delete, agent run opening, project opening, usage → plans, theme, settings, admin (role-gated), sign out.
- Chat: send (Enter), newline (Shift+Enter), stop, regenerate, copy, clear-all through delete.
- Agent: run, pause, resume, stop, approve, request changes, edit task, regenerate, follow-ups, tab switches, refresh iframe, fullscreen, four export formats, per-file save.
- Settings: provider switch, model, API base, auto-approve, theme, export JSON, clear data (confirm modal), sign out.
- Plans: switch plans, cancel, export data. Admin: refresh stats, assign plans, inspect runs.

Errors are surfaced inline (limit reached, model unavailable → demo fallback note, invalid auth, export failure) rather than with dead buttons.

---

## Notes & limitations

- The UI in *this* workspace is a Vite SPA; the Next.js server lives in `server/` for deployment because the workspace build is fixed to Vite. `package.json` was intentionally not modified; Playwright is installed as a dependency for the server runner but only used by `server/lib/browser.ts`.
- The reader fallback depends on two public services (Jina Reader, Microlink). If either is rate-limited, the card shows a specific error; the real Chrome backend needs no third-party browsing services.
- The real Chrome agent requires the Python backend to be running and Chrome to be fully closed. When it is unreachable the UI says so and falls back to the reader engine rather than failing silently.
- The demo chat model is deterministic and honest. Agent answers are extractive: statements are quoted from pages that were actually opened, with citations, and consequential details (visas, money, health) are flagged for verification on the official source.
- PDF export uses jsPDF text layout; DOCX uses the `docx` package. Both are real files, generated from the current artifact.
- `live preview` sandbox uses `allow-same-origin` only; generated landing pages contain no scripts.
- AI can make mistakes. Verify important information.
