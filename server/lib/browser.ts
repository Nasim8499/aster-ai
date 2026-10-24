/**
 * Playwright browser automation for the Aster Agent.
 *
 * Real headless Chromium: navigates, clicks, screenshots and extracts the live
 * DOM. Screenshots are streamed to the client as base64 JPEG data URLs so the
 * live preview is the actual browser the agent is driving.
 *
 * Install once:  npm i playwright && npx playwright install chromium --with-deps
 * On Cloudflare Workers use Browser Rendering (@cloudflare/playwright) instead;
 * the rest of this module is transport-agnostic.
 */
import type { Browser, BrowserContext, Page } from "playwright";

export type Emit = (event: Record<string, unknown>) => void;

export interface BrowseOptions {
  task: string;
  maxSources?: number;
  headless?: boolean;
  viewport?: { width: number; height: number };
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Aster/1.0";

function readerUrls(task: string) {
  const direct = task.match(/https?:\/\/\S+/);
  if (direct) return [direct[0]];
  const q = encodeURIComponent(task.replace(/^(find|search|research)\s+/i, ""));
  return [`https://duckduckgo.com/html/?q=${q}`, `https://www.bing.com/search?q=${q}`];
}

export function searchUrl(task: string) {
  return readerUrls(task)[0];
}

async function shot(page: Page): Promise<string | null> {
  try {
    const buffer = await page.screenshot({ type: "jpeg", quality: 62, animations: "disabled" });
    return `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function runPlaywright(opts: BrowseOptions, emit: Emit, signal: { aborted: boolean }) {
  const { chromium } = await import("playwright");
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    emit({ type: "log", text: "Launching headless Chromium", tone: "info" });
    browser = await chromium.launch({ headless: opts.headless !== false, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    context = await browser.newContext({
      userAgent: UA,
      viewport: opts.viewport ?? { width: 1440, height: 900 },
      locale: "en-US",
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);

    emit({ type: "step", id: "understand", status: "active" });
    emit({ type: "log", text: `Task: ${opts.task.slice(0, 120)}`, tone: "info" });
    await new Promise((r) => setTimeout(r, 350));
    emit({ type: "step", id: "understand", status: "done" });

    emit({ type: "step", id: "search", status: "active" });
    const start = searchUrl(opts.task);
    emit({ type: "log", text: `Searching ${new URL(start).host}`, tone: "network" });
    await page.goto(start, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    emit({ type: "page", url: page.url(), title: (await page.title()) || "Search", screenshot: await shot(page), index: 1 });
    emit({
      type: "log",
      text: `Loaded ${page.url()}`,
      tone: "success",
    });

    // Collect organic result links from the live DOM.
    const links = await page
      .$$eval("a[href]", (anchors) =>
        anchors
          .map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent ?? "").trim() }))
          .filter((l) => /^https?:\/\//.test(l.href) && l.text.length > 8),
      )
      .catch(() => [] as { href: string; text: string }[]);

    const blocked = /duckduckgo\.com|bing\.com|google\.com|microsoft\.com|duckduckgo|yahoo\.com|facebook\.com|linkedin\.com\/login/i;
    const seen = new Set<string>();
    const queue = links
      .filter((l) => {
        try {
          const host = new URL(l.href).hostname;
          if (blocked.test(host)) return false;
          if (seen.has(host)) return false;
          seen.add(host);
          return true;
        } catch {
          return false;
        }
      })
      .slice(0, Math.max(1, Math.min(5, opts.maxSources ?? 3)));

    if (!queue.length) queue.push({ href: start, text: "Search results" });
    emit({ type: "step", id: "search", status: "done" });

    emit({ type: "step", id: "open", status: "active" });
    emit({ type: "log", text: `Queueing ${queue.length} live sources`, tone: "info" });
    emit({ type: "step", id: "open", status: "done" });

    emit({ type: "step", id: "read", status: "active" });
    const sources: { url: string; title: string; text: string; screenshot?: string }[] = [];
    for (let i = 0; i < queue.length; i++) {
      if (signal.aborted) break;
      const target = queue[i];
      emit({ type: "log", text: `Navigating to ${target.href}`, tone: "network" });
      try {
        const res = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(900);
        const title = (await page.title()) || target.text.slice(0, 80);
        const screenshot = await shot(page);

        // A tiny real interaction: scroll, like a person reading the page.
        await page.mouse.wheel(0, 420).catch(() => {});
        await page.waitForTimeout(320);

        const text = await page
          .evaluate(() => {
            document.querySelectorAll("script,style,noscript,svg,nav,footer,aside,header").forEach((n) => n.remove());
            const main = document.querySelector("main,article,[role=main]") ?? document.body;
            return (main?.textContent ?? "").replace(/\s+/g, " ").trim();
          })
          .catch(() => "");

        emit({ type: "page", url: page.url(), title, screenshot, index: i + 1 });
        emit({ type: "log", text: `Read “${title}” — ${text.length.toLocaleString()} characters (HTTP ${res?.status() ?? "?"})`, tone: "success" });
        emit({
          type: "source",
          url: page.url(),
          title,
          text: text.slice(0, 12000),
          screenshot,
          statusCode: res?.status() ?? null,
        });
        sources.push({ url: page.url(), title, text, screenshot });
      } catch (e) {
        emit({ type: "log", text: `Skipped ${target.href}: ${e instanceof Error ? e.message.split("\n")[0] : "navigation error"}`, tone: "warn" });
      }
    }
    emit({ type: "step", id: "read", status: "done" });

    emit({ type: "step", id: "compare", status: "active" });
    emit({ type: "log", text: `Comparing ${sources.length} pages`, tone: "info" });
    await new Promise((r) => setTimeout(r, 400));
    emit({ type: "step", id: "compare", status: "done" });

    emit({ type: "step", id: "answer", status: "active" });
    const answer = await compose(opts.task, sources, emit);
    emit({ type: "step", id: "answer", status: "done" });
    emit({ type: "done", answer });
  } catch (e) {
    emit({ type: "error", message: e instanceof Error ? e.message : "Playwright run failed" });
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

/** Gemini synthesis when configured, extractive synthesis otherwise. */
async function compose(task: string, sources: { url: string; title: string; text: string }[], emit: Emit) {
  if (process.env.GEMINI_API_KEY && sources.length) {
    try {
      const context = sources
        .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}\n${s.text.slice(0, 4000)}`)
        .join("\n\n");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `Task: ${task}\n\nLive web pages just browsed:\n${context}\n\nWrite a concise, well-structured markdown answer. Cite sources as [1], [2]. Only use facts present above; say what could not be verified. End with a Sources list.` }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1600 },
          }),
        },
      );
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const frames = buf.split(/\r?\n\r?\n/);
          buf = frames.pop() ?? "";
          for (const frame of frames) {
            const data = frame.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
              if (delta) {
                full += delta;
                emit({ type: "answer", delta });
              }
            } catch {
              /* skip */
            }
          }
        }
        if (full.trim()) return full;
      }
    } catch {
      emit({ type: "log", text: "Gemini synthesis unavailable — using extractive summary", tone: "warn" });
    }
  }

  const sentences = sources.flatMap((s, i) =>
    s.text
      .split(/(?<=[.!?])\s+/)
      .filter((x) => x.length > 70 && x.length < 300)
      .slice(0, 3)
      .map((x) => `${x.trim()} **[${i + 1}]**`),
  );
  const markdown = [
    `Here's what I found after browsing **${sources.length} live ${sources.length === 1 ? "page" : "pages"}** with Playwright.`,
    "",
    "### Key findings",
    ...(sentences.length ? sentences.slice(0, 7).map((s, i) => `${i + 1}. ${s}`) : ["The pages loaded but their readable text was blocked or empty."]),
    "",
    "### Sources I opened",
    ...sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`),
    "",
    "> Browsed with headless Chromium via Playwright. Verify consequential details on the official source.",
  ].join("\n");
  emit({ type: "answer", delta: markdown });
  return markdown;
}
