import type { Message, Settings } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const VISA_NOTE = `> **Verify before acting.** Rules change and depend on your profile. Always confirm with the [ICA](https://www.ica.gov.sg/) and the [Singapore MFA](https://www.mfa.gov.sg/) before paying or booking travel.`;

function brandFrom(prompt: string) {
  const m = prompt.match(/\b(?:called|named)\s+["“]?([A-Z][\w&'-]{2,24})/);
  if (m) return m[1];
  if (/recruit|staffing|manpower/i.test(prompt)) return "TalentBridge";
  return "VisaHOBe";
}

/** Deterministic, useful demo model. Honest about being a local draft. */
export function localReply(prompt: string, context?: string): string {
  const p = prompt.toLowerCase().trim();
  const brand = brandFrom(prompt);

  if (/^(hi|hello|hey|salam|assalam|good (morning|evening))\b/.test(p)) {
    return `Hello — I'm **Aster**, your personal AI assistant.

I can help in two ways:

- **Chat** — think through a problem, draft copy, explain a rule, review something you paste in.
- **Agent** — give me a task and I'll plan it, work step-by-step, and build the result in a live preview you can watch and download.

A good first task: *"Research a topic and summarise the live pages with sources."* Switch the mode to **Agent** and press run.`;
  }

  if (/summar(ise|ize).*(last|previous).*(agent|run|result)/.test(p)) {
    return context
      ? `Here's the summary of your most recent agent run:\n\n${context}`
      : `You don't have a completed agent run yet. Run something in **Agent** mode — for example a landing page or a visa checklist — and I'll summarise the result here, including the files it produced.`;
  }

  if (/visa|passport|singapore|immigration/.test(p)) {
    return `## Bangladesh → Singapore visa: a planning brief

${VISA_NOTE}

**Short answer:** ordinary Bangladeshi passport holders generally need a visa before travelling to Singapore. Short visits are usually applied for through an **authorised visa agent** or a Singapore overseas mission, and the visa is tied to your purpose and dates.

### Core documents most applicants need
- Passport valid for at least six months beyond the stay, with blank pages
- Completed application form and a compliant photograph
- Return/onward itinerary and proof of accommodation
- Bank statements or a sponsor letter covering the trip
- Employer or student letter confirming ties and leave
- Prior visas / travel history (helps, isn't required)

### Process at a glance
| Stage | What happens | Who |
| --- | --- | --- |
| 1 | Confirm purpose and dates | You |
| 2 | Choose an authorised agent / mission | You |
| 3 | Assemble and verify documents | Agent + you |
| 4 | Submit and track | Agent |
| 5 | Travel with visa + supporting copies | You |

### Watch-outs
Weak proof of funds, mismatched dates, and unclear purpose are the most common refusal risks. Never book non-refundable travel before the visa is issued.

Want this as a tracked checklist with a document table? Switch to **Agent** and use:
\`\`\`text
Ask the agent to collect visa requirements for a route and build a client document checklist
\`\`\``;
  }

  if (/landing page|website|homepage/.test(p)) {
    return `## A landing page that earns trust

For a ${/visa/.test(p) ? "visa consultancy" : "service business"}, the page should answer three questions fast: *can you help me*, *what does it cost in effort*, and *what happens next*.

**Section order**
1. Sticky nav with one primary CTA
2. Hero: outcome headline, one-line proof, two actions
3. Trust strip (credentials, not adjectives)
4. Three services with concrete outcomes
5. Four-step process timeline
6. Sample client story
7. Closing CTA + honest note about results

**Draft hero copy**

> **Move forward, borderless.**
> ${brand} helps families and professionals secure work, study and family visas with a documented strategy — not a list of guesses.
> *Start free eligibility check* · *Explore services*

I can build the real thing — layout, responsive CSS and all copy — in a live preview. Set mode to **Agent** and send:
\`\`\`text
Describe the deliverable you need and where the agent should start
\`\`\``;
  }

  if (/competitor|market research|research.*report/.test(p)) {
    return `## Competitor research: a decision-ready structure

Numbers must come from real research, so here's the framework I'd fill with sources instead of invented figures.

| Layer | What to capture | Why it matters |
| --- | --- | --- |
| Direct competitors | Offer, fees, processing claim | Positioning |
| Adjacent players | Recruiters, relocation firms | Partnership surface |
| Self-serve tools | Checklists, e-visa portals | Price anchor |
| Reviews | Recurring complaints | Your wedge |

**Five moves most agencies miss**
1. Publishing corridor-specific requirement pages
2. Showing a transparent fee schedule
3. A low-risk paid eligibility check
4. Documented client stories with real timelines
5. A tracked checklist clients can see

Want the full report document with tables, risks and next steps? Switch to **Agent**:
\`\`\`text
Ask the agent to compare a set of sites and produce a report
\`\`\``;
  }

  if (/business plan|financial|pitch|strategy/.test(p)) {
    return `## Business plan skeleton

**1. Executive summary** — the wedge, the buyer, the proof.
**2. Customer & pain** — applicant vs. employer, and who actually pays.
**3. Offer** — assessment → application management → arrival support.
**4. Market sizing** — TAM / SAM / SOM, each with a cited method.
**5. Model** — fixed packages + employer retainers.
**6. GTM** — corridor pages, partnerships, referral loop.
**7. Ops** — SOP per destination, QA before submission.
**8. Financial model** — deposit + milestone billing, not vanity forecasts.
**9. Risks** — policy change, refusals, reputation.

I can turn this into a full document with tables and a 90-day plan in Agent mode.`;
  }

  if (/automate|workflow|email/.test(p)) {
    return `## Client follow-up automation

**Trigger:** new enquiry \`form.submission\`

| # | Delay | Intent |
| --- | --- | --- |
| 1 | 0 min | Confirm receipt, set expectations |
| 2 | 1 day | Eligibility questions + booking link |
| 3 | 3 days | Corridor guide, no hard sell |
| 4 | 7 days | Invite a 20-minute call |
| 5 | 14 days | Close the loop |

\`\`\`json
{
  "trigger": "form.submission",
  "exitOnReply": true,
  "steps": [
    { "type": "email", "template": "confirm", "delayMinutes": 0 },
    { "type": "email", "template": "eligibility", "delayMinutes": 1440 },
    { "type": "email", "template": "guide", "delayMinutes": 4320 }
  ]
}
\`\`\`

**Guardrails:** stop on reply, business hours only, unsubscribe link, never email passport numbers, log consent. Agent mode can produce the full blueprint plus JSON definition.`;
  }

  if (/price|plan|limit|subscription|upgrade/.test(p)) {
    return `Aster currently offers three plans:

- **Free** — 30 chats and 5 agent runs each month
- **Pro ($20/mo)** — 2,000 chats, 200 agent runs, all export formats
- **Team ($49/mo)** — 10,000 chats, 1,000 runs, shared projects and admin tools

Open **Plans** in the sidebar to see your live usage. Billing is simulated in this build, so plan changes are instant and no card is charged.`;
  }

  return `Here's a structured first pass on **${prompt.trim().replace(/\s+/g, " ").slice(0, 120)}**.

**What I'd clarify first**
- Who is this for, and what decision should it help them make?
- What constraints matter — time, budget, policy, tone?
- What does "done" look like — a document, a page, a checklist?

**A practical outline**
1. Frame the goal in one sentence
2. List what you already know vs. what needs checking
3. Build the smallest useful version
4. Review it against the original goal
5. Ship it with a clear next step for the reader

If you want me to actually **produce** the artifact — a landing page, report, checklist or workflow — switch to **Agent** mode and describe the deliverable. I'll show the plan and build it live.

_This reply comes from the built-in demo model. Add a Gemini key or backend proxy in Settings to use a live model._`;
}

/** Rough server-mode streaming client, falling back to the local model. */
export async function streamReply(
  settings: Settings,
  history: Message[],
  prompt: string,
  context: string | undefined,
  onDelta: (chunk: string) => void,
  signal: AbortSignal,
): Promise<{ provider: "gemini" | "demo"; note?: string }> {
  if (settings.provider === "demo") {
    await streamLocal(localReply(prompt, context), onDelta, signal);
    return { provider: "demo" };
  }

  const base = settings.proxyBase.trim().replace(/\/+$/, "");
  const url = `${base}/api/chat?stream=1`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.geminiModel,
        messages: [
          ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: prompt },
        ],
      }),
      signal,
    });
    const ctype = res.headers.get("content-type") ?? "";
    if (!res.ok || ctype.includes("text/html")) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error("No stream body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let got = false;
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
          const j = JSON.parse(data);
          const text =
            j?.candidates?.[0]?.content?.parts?.map((x: any) => x?.text ?? "").join("") ??
            j?.delta ??
            j?.text ??
            "";
          if (text) {
            got = true;
            onDelta(text);
          }
        } catch {
          /* ignore malformed frames */
        }
      }
    }
    if (!got) throw new Error("Empty model response");
    return { provider: "gemini" };
  } catch (e) {
    if (signal.aborted) throw e;
    await streamLocal(localReply(prompt, context), onDelta, signal);
    return {
      provider: "demo",
      note: `Live model unavailable (${e instanceof Error ? e.message : "network error"}) — answered with the demo model.`,
    };
  }
}

export async function streamLocal(text: string, onDelta: (chunk: string) => void, signal: AbortSignal) {
  const words = text.split(/(\s+)/);
  let buffer = "";
  for (let i = 0; i < words.length; i++) {
    if (signal.aborted) return;
    buffer += words[i];
    if (buffer.length > 3 || i === words.length - 1) {
      onDelta(buffer);
      buffer = "";
      await sleep(11);
    }
  }
}
