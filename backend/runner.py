"""
Browser Use runner — drives the user's REAL Chrome profile.

Design notes
------------
* `browser_use` changes quickly, so every integration point is defensive:
  `Browser.from_system_chrome(profile_directory=...)` is tried first with the
  documented fallback to `Browser(executable_path=..., user_data_dir=...,
  profile_directory=...)`.
* Screenshots use `agent.browser_session.event_bus.dispatch(ScreenshotEvent)`
  as requested, with a CDP `page.screenshot()` fallback for older versions.
* Events are buffered per session and fanned out to SSE subscribers, so the UI
  can reconnect without losing the timeline.
"""

from __future__ import annotations

import asyncio
import base64
import inspect
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

# --------------------------------------------------------------------------
# Optional imports — report a clear error instead of crashing at import time.
# --------------------------------------------------------------------------
IMPORT_ERROR: Optional[str] = None
Agent = None  # type: ignore
Browser = None  # type: ignore
ScreenshotEvent = None  # type: ignore

try:  # pragma: no cover - depends on installed version
    from browser_use import Agent, Browser  # type: ignore

    try:
        from browser_use.browser.events import ScreenshotEvent  # type: ignore
    except Exception:  # older/newer module layout
        try:
            from browser_use.events import ScreenshotEvent  # type: ignore
        except Exception:
            ScreenshotEvent = None
except Exception as exc:  # pragma: no cover
    IMPORT_ERROR = str(exc)


# --------------------------------------------------------------------------
# Chrome discovery
# --------------------------------------------------------------------------
def default_user_data_dir() -> Optional[str]:
    home = Path.home()
    candidates = [
        home / "Library/Application Support/Google/Chrome",  # macOS
        home / ".config/google-chrome",  # Linux
        home / ".config/chromium",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/User Data",  # Windows
    ]
    for path in candidates:
        if path and path.exists():
            return str(path)
    return None


def pick(obj: Any, default: Any = None) -> Any:
    return obj if obj else default


async def build_browser() -> Any:
    """Create a Browser bound to the real Chrome profile."""
    if Browser is None:
        raise RuntimeError(
            "browser_use is not installed. Run `pip install -r requirements.txt` in backend/."
        )

    profile = os.getenv("CHROME_PROFILE_DIR", "Default")
    user_data_dir = os.getenv("CHROME_USER_DATA_DIR") or default_user_data_dir()
    executable = os.getenv("CHROME_EXECUTABLE")

    # 1) Preferred API — system Chrome with a named profile.
    from_system = getattr(Browser, "from_system_chrome", None)
    if callable(from_system):
        for kwargs in ({"profile_directory": profile}, {}):
            try:
                browser = from_system(**kwargs)
                if inspect.isawaitable(browser):
                    browser = await browser
                return browser
            except TypeError:
                continue
            except Exception:
                break

    # 2) Documented fallback.
    if not user_data_dir:
        raise RuntimeError(
            "Could not locate Chrome's user data directory. Set CHROME_USER_DATA_DIR "
            "in backend/.env (see .env.example)."
        )
    return Browser(
        executable_path=executable,
        user_data_dir=user_data_dir,
        profile_directory=profile,
    )


# --------------------------------------------------------------------------
# LLM factory
# --------------------------------------------------------------------------
def build_llm() -> Any:
    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    model = os.getenv("LLM_MODEL", "gpt-4.1-mini")

    if provider in {"openai", "openai-compatible", "custom"}:
        try:
            from browser_use import ChatOpenAI  # type: ignore
        except Exception:
            from browser_use.llm import ChatOpenAI  # type: ignore

        kwargs: Dict[str, Any] = {"model": model}
        if os.getenv("OPENAI_API_KEY"):
            kwargs["api_key"] = os.getenv("OPENAI_API_KEY")
        base = os.getenv("LLM_BASE_URL") or os.getenv("OPENAI_BASE_URL")
        if base:
            kwargs["base_url"] = base
        if os.getenv("LLM_API_KEY"):
            kwargs["api_key"] = os.getenv("LLM_API_KEY")
        return ChatOpenAI(**kwargs)

    if provider in {"google", "gemini"}:
        try:
            from browser_use import ChatGoogle  # type: ignore
        except Exception:
            from browser_use.llm import ChatGoogle  # type: ignore

        key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("Set GOOGLE_API_KEY or GEMINI_API_KEY in backend/.env")
        return ChatGoogle(model=model, api_key=key)

    if provider == "anthropic":
        try:
            from browser_use import ChatAnthropic  # type: ignore
        except Exception:
            from browser_use.llm import ChatAnthropic  # type: ignore

        key = os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("Set ANTHROPIC_API_KEY in backend/.env")
        return ChatAnthropic(model=model, api_key=key)

    if provider == "ollama":
        try:
            from browser_use import ChatOllama  # type: ignore
        except Exception:
            from browser_use.llm import ChatOllama  # type: ignore

        return ChatOllama(model=os.getenv("OLLAMA_MODEL", model))

    raise RuntimeError(f"Unsupported LLM_PROVIDER={provider!r}. Use openai, google, anthropic or ollama.")


# --------------------------------------------------------------------------
# Screenshots
# --------------------------------------------------------------------------
def to_data_url(value: Any) -> Optional[str]:
    if not value:
        return None
    if isinstance(value, bytes):
        return "data:image/jpeg;base64," + base64.b64encode(value).decode()
    if isinstance(value, str):
        if value.startswith("data:image"):
            return value
        try:
            base64.b64decode(value, validate=False)
            return "data:image/jpeg;base64," + value
        except Exception:
            return None
    return None


async def capture_screenshot(agent: Any) -> Optional[str]:
    """Prefer the event bus (as specified); fall back to CDP."""
    session = getattr(agent, "browser_session", None)
    if session is None:
        return None

    # 1) ScreenshotEvent via the event bus
    bus = getattr(session, "event_bus", None)
    if bus is not None and ScreenshotEvent is not None:
        try:
            event = bus.dispatch(ScreenshotEvent(full_page=False))
            if inspect.isawaitable(event):
                event = await asyncio.wait_for(event, timeout=20)
            data = getattr(event, "screenshot", None)
            if data is None and isinstance(event, dict):
                data = event.get("screenshot")
            if data is None and isinstance(event, (str, bytes)):
                data = event
            url = to_data_url(data)
            if url:
                return url
        except Exception:
            pass

    # 2) CDP fallback
    for getter in ("get_current_page", "get_agent_current_page"):
        fn = getattr(session, getter, None)
        if not callable(fn):
            continue
        try:
            page = fn()
            if inspect.isawaitable(page):
                page = await page
            if page is None:
                continue
            shot_fn = getattr(page, "screenshot", None)
            if not callable(shot_fn):
                continue
            raw = shot_fn()
            if inspect.isawaitable(raw):
                raw = await asyncio.wait_for(raw, timeout=20)
            url = to_data_url(raw)
            if url:
                return url
        except Exception:
            continue
    return None


# --------------------------------------------------------------------------
# Session state
# --------------------------------------------------------------------------
@dataclass
class RunSession:
    id: str
    task: str
    max_steps: int
    status: str = "connecting"  # connecting|running|paused|stopping|done|error|stopped
    step: int = 0
    url: Optional[str] = None
    title: Optional[str] = None
    screenshot: Optional[str] = None
    result: Optional[str] = None
    error: Optional[str] = None
    hint: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    events: List[Dict[str, Any]] = field(default_factory=list)
    subscribers: List[asyncio.Queue] = field(default_factory=list)
    agent: Any = None
    runner: Optional[asyncio.Task] = None
    paused: bool = False

    def emit(self, event: Dict[str, Any]) -> None:
        event = {"ts": time.time(), **event}
        event.setdefault("seq", len(self.events))
        self.events.append(event)
        self.updated_at = time.time()
        for queue in list(self.subscribers):
            try:
                queue.put_nowait(event)
            except Exception:
                pass

    def public(self) -> Dict[str, Any]:
        return {
            "session_id": self.id,
            "task": self.task,
            "status": self.status,
            "step": self.step,
            "url": self.url,
            "title": self.title,
            "result": self.result,
            "error": self.error,
            "hint": self.hint,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    async def subscribe(self, from_seq: int = 0) -> AsyncGenerator[Dict[str, Any], None]:
        queue: asyncio.Queue = asyncio.Queue()
        for old in self.events[from_seq:]:
            queue.put_nowait(old)
        self.subscribers.append(queue)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield event
                except asyncio.TimeoutError:
                    yield {"type": "ping", "ts": time.time()}
        finally:
            if queue in self.subscribers:
                self.subscribers.remove(queue)


SESSIONS: Dict[str, RunSession] = {}


def make_hint(exc: Exception) -> str:
    text = str(exc)
    lowered = text.lower()
    if "profile" in lowered and ("in use" in lowered or "lock" in lowered):
        return "Your Chrome profile is locked. Fully quit Chrome (including background processes) and try again."
    if "executable" in lowered or "chrome" in lowered and "not found" in lowered:
        return "Chrome was not found. Set CHROME_EXECUTABLE in backend/.env."
    if "api" in lowered and ("key" in lowered or "auth" in lowered):
        return "The LLM rejected the API key. Check LLM_PROVIDER and the matching API key in backend/.env."
    if "connect" in lowered or "target closed" in lowered:
        return "The browser connection closed. Fully quit Chrome, then start again."
    return "Check backend/.env, confirm Chrome is completely closed, and review the server console."


def call_maybe_async(fn: Any, *args: Any, **kwargs: Any) -> Any:
    try:
        result = fn(*args, **kwargs)
        return result
    except TypeError:
        return fn()


def extract_result(agent: Any) -> Optional[str]:
    history = getattr(agent, "history", None)
    if history is None:
        return None
    for getter in ("final_result", "result"):
        fn = getattr(history, getter, None)
        if callable(fn):
            try:
                value = fn()
                if value:
                    return str(value)
            except Exception:
                pass
    try:
        items = history.history
        for item in reversed(items):
            result = getattr(item, "result", None)
            if result:
                for attr in ("extracted_content", "long_term_memory", "memory"):
                    value = getattr(result, attr, None)
                    if value:
                        return str(value)
    except Exception:
        pass
    return None


def history_tail(agent: Any) -> Dict[str, Any]:
    """Thoughts, URLs and actions from agent.history (never raises)."""
    out: Dict[str, Any] = {"thoughts": [], "urls": [], "actions": []}
    history = getattr(agent, "history", None)
    if history is None:
        return out
    for key, method in (("urls", "urls"), ("thoughts", "model_thoughts"), ("actions", "model_actions")):
        fn = getattr(history, method, None)
        if callable(fn):
            try:
                value = fn() or []
                out[key] = value[-12:]
            except Exception:
                pass
    return out


async def run_agent(session: RunSession) -> None:
    browser = None
    try:
        if IMPORT_ERROR:
            raise RuntimeError(f"browser_use import failed: {IMPORT_ERROR}")

        session.emit({"type": "status", "status": "connecting"})
        session.emit({"type": "thought", "text": "Launching your real Chrome profile…"})
        browser = await build_browser()
        llm = build_llm()

        session.emit({"type": "thought", "text": "Starting the Browser Use agent. Fully close Chrome if you see a profile lock error."})
        agent = Agent(task=session.task, browser=browser, llm=llm)
        session.agent = agent
        session.status = "running"
        session.emit({"type": "status", "status": "running"})

        async def on_step_end(current: Any = None, *args: Any, **kwargs: Any) -> None:
            agent_ref = current or agent
            session.step += 1
            info = history_tail(agent_ref)

            for thought in info["thoughts"][-3:]:
                if thought:
                    session.emit({"type": "thought", "text": str(thought)[:1500], "step": session.step})
            for action in info["actions"][-6:]:
                text = str(action)
                session.emit({"type": "action", "text": text[:1000], "step": session.step})

            urls = [u for u in info["urls"] if isinstance(u, str)]
            if urls:
                session.url = urls[-1]
                session.emit({"type": "url", "url": session.url, "step": session.step})

            shot = await capture_screenshot(agent_ref)
            if shot:
                session.screenshot = shot
                session.emit(
                    {
                        "type": "screenshot",
                        "data": shot,
                        "url": session.url,
                        "step": session.step,
                    }
                )
            session.emit({"type": "step", "step": session.step, "status": "running"})
            session.emit({"type": "status", "status": "running"})

        result = await agent.run(on_step_end=on_step_end, max_steps=session.max_steps)
        session.result = extract_result(agent) or (str(result) if result else "The agent finished without returning a summary.")
        session.status = "done"
        session.emit({"type": "result", "text": session.result, "success": True})
        session.emit({"type": "status", "status": "done"})
        session.emit({"type": "done"})
    except asyncio.CancelledError:
        if session.status not in {"stopped", "done"}:
            session.status = "stopped"
            session.emit({"type": "status", "status": "stopped"})
            session.emit({"type": "done"})
        return
    except Exception as exc:  # noqa: BLE001 - surfaced to the UI
        session.status = "error"
        session.error = str(exc)
        session.hint = make_hint(exc)
        print(f"[agent] error: {exc}")
        session.emit({"type": "error", "message": session.error, "hint": session.hint})
        session.emit({"type": "status", "status": "error"})
        session.emit({"type": "done"})
    finally:
        if os.getenv("KEEP_BROWSER_OPEN", "false").lower() not in {"1", "true", "yes"}:
            try:
                if browser is not None:
                    for method in ("kill", "close"):
                        fn = getattr(browser, method, None)
                        if callable(fn):
                            value = fn()
                            if inspect.isawaitable(value):
                                await value
                            break
            except Exception:
                pass


def start_session(task: str, max_steps: int) -> RunSession:
    session = RunSession(id=uuid.uuid4().hex[:12], task=task, max_steps=max_steps)
    SESSIONS[session.id] = session
    session.emit({"type": "meta", "session_id": session.id, "task": task, "max_steps": max_steps})
    session.runner = asyncio.create_task(run_agent(session))
    return session


async def control(session: RunSession, action: str) -> Dict[str, Any]:
    agent = session.agent
    if action == "pause":
        fn = getattr(agent, "pause", None) if agent is not None else None
        if not callable(fn):
            raise ValueError(
                "This browser-use version does not expose agent.pause(). Use Stop to end the run, or upgrade browser-use."
            )
        call_maybe_async(fn)
        session.paused = True
        session.status = "paused"
        session.emit({"type": "status", "status": "paused"})
        session.emit({"type": "thought", "text": "Paused by the user.", "step": session.step})
        return {"ok": True, "status": session.status}

    if action == "resume":
        fn = getattr(agent, "resume", None) if agent is not None else None
        if not callable(fn):
            raise ValueError("This browser-use version does not expose agent.resume(). Start a new run instead.")
        call_maybe_async(fn)
        session.paused = False
        session.status = "running"
        session.emit({"type": "status", "status": "running"})
        session.emit({"type": "thought", "text": "Resumed by the user.", "step": session.step})
        return {"ok": True, "status": session.status}

    if action == "stop":
        session.status = "stopping"
        session.emit({"type": "status", "status": "stopping"})
        if agent is not None:
            fn = getattr(agent, "stop", None)
            if callable(fn):
                call_maybe_async(fn)
        if session.runner and not session.runner.done():
            session.runner.cancel()
        session.status = "stopped"
        session.emit({"type": "status", "status": "stopped"})
        session.emit({"type": "done"})
        return {"ok": True, "status": session.status}

    raise ValueError(f"Unknown action {action!r}")
