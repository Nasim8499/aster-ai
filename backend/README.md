# Aster — real Chrome agent (Python + Browser Use)

This backend gives Aster a **real browser agent**: it launches *your installed Google Chrome*
with your own profile, lets the open-source [`browser-use`](https://github.com/browser-use/browser-use)
agent act inside it, and streams a live screenshot plus the agent's thoughts, actions and URLs to
the frontend over SSE.

> ⚠️ **Fully close Chrome before starting.** Only one process can use a Chrome profile. If Chrome is
> already running you will get a profile-lock error and the agent cannot connect.

---

## 1. Install

Requires **Python 3.11+** and Google Chrome.

```bash
cd backend
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows (PowerShell)
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

```env
LLM_PROVIDER=openai            # or google / anthropic / ollama
LLM_MODEL=gpt-4.1-mini
OPENAI_API_KEY=sk-...
CHROME_PROFILE_DIR=Default     # your real Chrome profile
```

Chrome path is auto-detected. If detection fails, set the explicit values shown in `.env.example`.

## 2. Run

```bash
# Fully quit Chrome first (including menu-bar / tray background apps)
uvicorn main:app --reload --port 8000
```

Health check: <http://127.0.0.1:8000/health>

```json
{ "ok": true, "browser_use": true, "chrome_profile": "Default",
  "llm_provider": "openai", "warning": "Fully close Chrome before starting." }
```

Serve the built frontend from the same origin (optional):

```bash
npm run build          # in the repo root, creates dist/
# SERVE_FRONTEND=true in .env → open http://127.0.0.1:8000
```

Otherwise run the UI with `npm run dev` (Vite, port 5173) and point it at this API.

## 3. Connect the UI

1. Open Aster → **Settings → Real Chrome agent**.
2. **Agent API URL**: `http://127.0.0.1:8000`
3. **Test agent** → should show `Real Chrome agent ready · provider/model · profile "Default"`.
4. Open a chat, switch the composer to **Agent**, and send a task.
5. A live card appears with the screenshot panel, step timeline (thought / action / URL) and controls.

If `AGENT_TOKEN` is set in `.env`, copy it into **Access token** in Settings.

## 4. What happens on Start

```
POST /api/agent/start { task, max_steps }
   → browser = Browser.from_system_chrome(profile_directory="Default")
     fallback: Browser(executable_path=…, user_data_dir=…, profile_directory="Default")
   → agent = Agent(task=task, browser=browser, llm=<from .env>)
   → await agent.run(on_step_end=on_step_end, max_steps=N)
```

`on_step_end` captures, on every step:

| Data | Source |
| --- | --- |
| Screenshot | `agent.browser_session.event_bus.dispatch(ScreenshotEvent(full_page=False))` → `event.screenshot` |
| Screenshot fallback | CDP `page.screenshot()` (for older `browser_use` layouts) |
| URL | `agent.history.urls()[-1]` |
| Thoughts | `agent.history.model_thoughts()` |
| Actions | `agent.history.model_actions()` |

These are appended to the session buffer and pushed to every SSE subscriber. The frontend can
reconnect with `?from_seq=` without losing the timeline.

## 5. API

| Route | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | capability + Chrome/LLM status |
| `/api/agent/start` | POST | `{ task, max_steps? }` → `{ session_id }` |
| `/api/agent/stream/{id}` | GET | SSE event stream |
| `/api/agent/status/{id}` | GET | snapshot |
| `/api/agent/result/{id}` | GET | final result / error / hint |
| `/api/agent/pause/{id}` | POST | `agent.pause()` |
| `/api/agent/resume/{id}` | POST | `agent.resume()` |
| `/api/agent/stop/{id}` | POST | `agent.stop()` + cancel task |
| `/api/agent/sessions` | GET | recent sessions |
| `/api/agent/sessions/{id}` | DELETE | forget a session |

SSE event shapes:

```jsonc
{ "type": "screenshot", "data": "data:image/jpeg;base64,…", "url": "https://…", "step": 3 }
{ "type": "thought",    "text": "…", "step": 3 }
{ "type": "action",     "text": "…", "step": 3 }
{ "type": "url",        "url": "https://…", "step": 3 }
{ "type": "result",     "text": "…" }
{ "type": "error",      "message": "…", "hint": "…" }
{ "type": "status",     "status": "running|paused|stopped|done|error" }
{ "type": "done" }
```

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `browser_use is not available` | Activate the venv and `pip install -r requirements.txt`. |
| Profile locked / `Failed to connect` | **Fully quit Chrome**, including tray/menu-bar processes, then restart. |
| Chrome not found | Set `CHROME_EXECUTABLE` and `CHROME_USER_DATA_DIR` in `.env`. |
| LLM auth error | Ensure the key matches `LLM_PROVIDER`; for Gemini also set `LLM_MODEL=gemini-2.5-flash`. |
| Screenshot empty | Upgrade `browser_use` (newer screenshot event API), or the CDP fallback is blocked by the page. |
| CORS error in the browser | Add your UI origin to `CORS_ORIGINS` in `.env` and restart. |
| 401 from the agent API | `AGENT_TOKEN` is set; add the same value in Settings → Access token. |

## 7. Safety

The agent controls a **real, logged-in Chrome profile**. Only run tasks you are comfortable automating,
keep an eye on the live screenshots, and use Stop if it starts something unintended. A dedicated
profile (`CHROME_PROFILE_DIR="Profile 2"`) is safer than your primary one for unattended runs.
