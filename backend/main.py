"""
Aster — Python agent backend.

Endpoints
---------
GET  /health                               backend / browser_use / Chrome status
POST /api/agent/start                      { task, max_steps? } -> { session_id }
GET  /api/agent/stream/{session_id}        Server-Sent Events (screenshots, thoughts, actions, URLs)
GET  /api/agent/status/{session_id}        current status snapshot
GET  /api/agent/result/{session_id}        final result
POST /api/agent/pause/{session_id}         agent.pause()
POST /api/agent/resume/{session_id}        agent.resume()
POST /api/agent/stop/{session_id}          agent.stop()
GET  /api/agent/sessions                   recent sessions
DELETE /api/agent/sessions/{session_id}    forget a finished session

Run:
    cd backend
    pip install -r requirements.txt
    cp .env.example .env         # add your LLM key
    uvicorn main:app --reload --port 8000

Then set "Agent API URL" in the Aster UI to http://127.0.0.1:8000.
"""

from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from runner import IMPORT_ERROR, SESSIONS, RunSession, control, default_user_data_dir, start_session

load_dotenv()

MAX_TASK_CHARS = int(os.getenv("MAX_TASK_CHARS", "4000"))
DEFAULT_MAX_STEPS = int(os.getenv("MAX_STEPS", "25"))
AGENT_TOKEN = os.getenv("AGENT_TOKEN", "").strip()
ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
).split(",") if o.strip()]


async def require_token(x_agent_token: Optional[str] = Header(default=None)) -> None:
    """Optional shared secret. Enabled only when AGENT_TOKEN is set."""
    if AGENT_TOKEN and x_agent_token != AGENT_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid agent access token.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if IMPORT_ERROR:
        print(f"[startup] browser_use unavailable: {IMPORT_ERROR}")
    else:
        print("[startup] browser_use loaded — your real Chrome profile will be used.")
    print(f"[startup] Chrome profile: {os.getenv('CHROME_PROFILE_DIR', 'Default')}")
    yield
    for session in list(SESSIONS.values()):
        if session.runner and not session.runner.done():
            session.runner.cancel()


app = FastAPI(title="Aster Agent API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS or ["*"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartBody(BaseModel):
    task: str = Field(min_length=1, max_length=MAX_TASK_CHARS)
    max_steps: Optional[int] = Field(default=None, ge=1, le=200)


@app.get("/health")
async def health() -> dict:
    return {
        "ok": IMPORT_ERROR is None,
        "browser_use": IMPORT_ERROR is None,
        "import_error": IMPORT_ERROR,
        "chrome_profile": os.getenv("CHROME_PROFILE_DIR", "Default"),
        "chrome_user_data_dir": os.getenv("CHROME_USER_DATA_DIR") or default_user_data_dir(),
        "llm_provider": os.getenv("LLM_PROVIDER", "openai"),
        "llm_model": os.getenv("LLM_MODEL", "gpt-4.1-mini"),
        "needs_token": bool(AGENT_TOKEN),
        "warning": "Fully close Chrome before starting.",
    }


@app.post("/api/agent/start", dependencies=[Depends(require_token)])
async def start(body: StartBody) -> dict:
    task = body.task.strip()
    if not task:
        raise HTTPException(status_code=400, detail="`task` is required.")
    if IMPORT_ERROR:
        raise HTTPException(
            status_code=503,
            detail=f"browser_use is not available: {IMPORT_ERROR}. Run pip install -r requirements.txt.",
        )
    steps = body.max_steps or DEFAULT_MAX_STEPS
    session = start_session(task, steps)
    return {
        "session_id": session.id,
        "status": session.status,
        "max_steps": steps,
        "warning": "Fully close Chrome before starting.",
        "stream": f"/api/agent/stream/{session.id}",
    }


def get_session(session_id: str) -> RunSession:
    session = SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found. It may have expired — start a new run.")
    return session


@app.get("/api/agent/stream/{session_id}")
async def stream(session_id: str, request: Request, from_seq: int = Query(default=0, ge=0)) -> StreamingResponse:
    session = get_session(session_id)

    async def generate():
        yield f"event: ready\ndata: {json.dumps({'session_id': session.id, 'status': session.status})}\n\n"
        try:
            async for event in session.subscribe(from_seq):
                if await request.is_disconnected():
                    break
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") == "done":
                    break
        except asyncio.CancelledError:
            return
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/agent/status/{session_id}")
async def status(session_id: str) -> dict:
    return get_session(session_id).public()


@app.get("/api/agent/result/{session_id}")
async def result(session_id: str) -> dict:
    session = get_session(session_id)
    return {
        "session_id": session.id,
        "status": session.status,
        "result": session.result,
        "error": session.error,
        "hint": session.hint,
        "url": session.url,
        "steps": session.step,
    }


@app.post("/api/agent/{action}/{session_id}", dependencies=[Depends(require_token)])
async def agent_control(action: str, session_id: str) -> dict:
    if action not in {"pause", "resume", "stop"}:
        raise HTTPException(status_code=404, detail="Unknown action.")
    session = get_session(session_id)
    try:
        return await control(session, action)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/agent/sessions", dependencies=[Depends(require_token)])
async def sessions() -> dict:
    ordered = sorted(SESSIONS.values(), key=lambda s: s.created_at, reverse=True)[:30]
    return {"sessions": [{**s.public(), "steps": s.step} for s in ordered]}


@app.delete("/api/agent/sessions/{session_id}", dependencies=[Depends(require_token)])
async def forget(session_id: str) -> dict:
    session = SESSIONS.pop(session_id, None)
    if session and session.runner and not session.runner.done():
        session.runner.cancel()
    return {"ok": True, "removed": bool(session)}


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    print(f"[unhandled] {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "hint": "Check the backend console and backend/.env."},
    )


# ---------------------------------------------------------------------------
# Serve the built frontend (../dist) from the same origin, when available.
# ---------------------------------------------------------------------------
DIST = Path(__file__).resolve().parent.parent / "dist"
if os.getenv("SERVE_FRONTEND", "true").lower() in {"1", "true", "yes"} and DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets") if (DIST / "assets").exists() else None

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(DIST / "index.html")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        if full_path.startswith("api/") or full_path == "health":
            return JSONResponse(status_code=404, content={"error": "Not found."})
        candidate = DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("AGENT_HOST", "127.0.0.1"),
        port=int(os.getenv("AGENT_PORT", "8000")),
        reload=True,
    )
