/**
 * Modular model gateway. Add providers by implementing ModelProvider and
 * registering them in `providers` — the API routes never import a vendor SDK.
 */
export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamChunk {
  text: string;
}

export interface ModelProvider {
  id: string;
  label: string;
  configured(): boolean;
  stream(messages: ChatTurn[], opts: { model?: string; signal?: AbortSignal }): AsyncGenerator<StreamChunk>;
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const ALLOWED = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];

const SYSTEM = `You are Aster, a concise, premium personal AI assistant.
In Chat you answer conversationally with clean markdown. You never claim to control a browser.
When a task would produce a deliverable (landing page, report, checklist, workflow), explain the structure and suggest Agent mode.`;

const gemini: ModelProvider = {
  id: "gemini",
  label: "Google Gemini",
  configured: () => !!process.env.GEMINI_API_KEY,
  async *stream(messages, opts) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured on the server.");
    const model = ALLOWED.includes(opts.model ?? "") ? opts.model! : "gemini-2.5-flash";
    const res = await fetch(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "user", parts: [{ text: SYSTEM }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split(/\r?\n\r?\n/);
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame
          .split(/\r?\n/)
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
          if (text) yield { text };
        } catch {
          /* skip malformed frames */
        }
      }
    }
  },
};

/** Deterministic fallback so the API is usable without any vendor key. */
const demo: ModelProvider = {
  id: "demo",
  label: "Aster demo model",
  configured: () => true,
  async *stream(messages) {
    const prompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const text = `You asked: **${prompt.slice(0, 120)}**\n\nThis is the demo model. Configure \`GEMINI_API_KEY\` on the server for live answers.\n\n- Chat is conversational\n- Agent mode produces a plan and a live artifact\n`;
    for (const word of text.split(/(\s+)/)) {
      await new Promise((r) => setTimeout(r, 12));
      yield { text: word };
    }
  },
};

export const providers: Record<string, ModelProvider> = { gemini, demo };

export function resolveProvider(id?: string): ModelProvider {
  if (id && providers[id]) return providers[id];
  return gemini.configured() ? gemini : demo;
}
