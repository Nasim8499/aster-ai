import type { AgentRun, AgentStatus, AgentStep, Artifact, ArtifactFile, LogLine } from "./types";

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;
const log = (text: string, tone: LogLine["tone"] = "info"): LogLine => ({ id: uid("log"), ts: Date.now(), text, tone });

export type Intent = "landing" | "visa" | "research" | "business" | "workflow" | "general";

export function detectIntent(task: string): Intent {
  const t = task.toLowerCase();
  if (/landing page|website|web page|html page|homepage|portfolio site/.test(t)) return "landing";
  if (/visa|passport|immigration|singapore|schengen|work permit/.test(t)) return "visa";
  if (/competitor|research|market|report|analysis|survey/.test(t)) return "research";
  if (/business plan|financial model|pitch|strategy|go.to.market/.test(t)) return "business";
  if (/automate|workflow|email|zapier|pipeline|sequence/.test(t)) return "workflow";
  return "general";
}

function brandFor(task: string, intent: Intent) {
  const explicit = task.match(/\b(?:called|named)\s+["“]?([A-Z][\w&'-]{2,24}(?:\s+[A-Z][\w&'-]{2,24})?)["”]?/);
  if (explicit) return explicit[1];
  const t = task.toLowerCase();
  if (/visa|liquid|immigration/.test(t)) return "VisaHOBe";
  if (/recruit|manpower|staffing|talent/.test(t)) return "TalentBridge";
  if (/real estate|property/.test(t)) return "Northline Property";
  if (intent === "landing") return "Aster Studio";
  return "VisaHOBe";
}

function topicFor(task: string) {
  const clean = task.replace(/^(create|build|make|write|research|find|generate|design|draft)\s+(a|an|the|me)?\s*/i, "").replace(/[.?!]$/, "");
  return clean.length > 4 ? clean : task;
}

/* ------------------------------------------------------------------ */
/* Landing page artifacts                                              */
/* ------------------------------------------------------------------ */

const LANDING_CSS = `
:root{--ink:#14161a;--muted:#5c6270;--line:#e6e3dc;--paper:#fbf9f4;--accent:#0f5f4e;--accent-soft:#e7f2ee;--gold:#c9a227}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;background:var(--paper);color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 28px}
a{color:inherit;text-decoration:none}
header{position:sticky;top:0;z-index:20;background:rgba(251,249,244,.86);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;gap:28px;height:72px}
.logo{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:-.02em;font-size:18px}
.logo-mark{width:30px;height:30px;border-radius:9px;background:linear-gradient(145deg,#14806a,#0f5f4e);display:grid;place-items:center;color:#fff;font-family:Georgia,serif;font-size:15px}
.nav-links{display:flex;gap:24px;font-size:14px;color:var(--muted);margin-left:auto}
.btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:500;border:1px solid var(--ink);background:var(--ink);color:#fff;transition:.2s transform}
.btn:hover{transform:translateY(-1px)}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.hero{display:grid;grid-template-columns:1.15fr .85fr;gap:56px;align-items:center;padding:78px 0 64px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);background:var(--accent-soft);border:1px solid #cfe5dd;padding:6px 12px;border-radius:999px}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:clamp(38px,4.4vw,58px);line-height:1.08;letter-spacing:-.025em;margin:20px 0 18px}
h1 em{font-style:italic;color:var(--accent)}
.lede{font-size:17px;color:var(--muted);max-width:46ch;margin:0 0 28px}
.actions{display:flex;gap:12px;flex-wrap:wrap}
.note{margin-top:18px;font-size:12.5px;color:var(--muted)}
.visual{position:relative;border-radius:26px;background:linear-gradient(160deg,#0f5f4e,#14806a 55%,#9ccfc1);min-height:360px;padding:24px;box-shadow:0 30px 60px -30px rgba(15,95,78,.5);overflow:hidden}
.visual:after{content:"";position:absolute;inset:auto -30% -40% -30%;height:70%;background:radial-gradient(ellipse at center,rgba(255,255,255,.35),transparent 65%)}
.card{position:relative;background:rgba(255,255,255,.94);border-radius:18px;padding:18px;box-shadow:0 18px 36px -22px rgba(6,44,36,.6)}
.card + .card{margin-top:14px}
.float{position:absolute;right:-10px;bottom:22px;background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 20px 40px -22px rgba(6,44,36,.6);display:flex;gap:10px;align-items:center;font-size:12.5px;z-index:2}
.tick{width:30px;height:30px;border-radius:50%;background:var(--accent-soft);display:grid;place-items:center;color:var(--accent);font-size:14px}
.trust{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:20px 0;display:flex;gap:38px;flex-wrap:wrap;align-items:center;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a8f9b}
.section{padding:66px 0}
.section h2{font-family:Georgia,serif;font-weight:400;font-size:32px;letter-spacing:-.02em;margin:0 0 8px}
.section p.sub{color:var(--muted);margin:0 0 34px;max-width:52ch}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.service{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;transition:.25s transform,.25s box-shadow}
.service:hover{transform:translateY(-3px);box-shadow:0 24px 40px -32px rgba(20,22,26,.5)}
.service h3{margin:14px 0 6px;font-size:16px;letter-spacing:-.01em}
.service p{margin:0;color:var(--muted);font-size:13.5px}
.icon{width:38px;height:38px;border-radius:11px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:16px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;counter-reset:step}
.step{position:relative;background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px}
.step:before{counter-increment:step;content:"0" counter(step);font-family:Georgia,serif;font-size:13px;color:var(--gold);letter-spacing:.1em}
.step h4{margin:8px 0 4px;font-size:14.5px}
.step p{margin:0;font-size:12.5px;color:var(--muted)}
.quote{background:#fff;border:1px solid var(--line);border-radius:24px;padding:34px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
.quote blockquote{margin:0;font-family:Georgia,serif;font-size:22px;line-height:1.45;letter-spacing:-.01em}
.quote cite{display:block;margin-top:14px;font-family:-apple-system,sans-serif;font-size:12.5px;color:var(--muted);font-style:normal}
.avatar{width:56px;height:56px;border-radius:50%;background:linear-gradient(145deg,#14806a,#0f5f4e);color:#fff;display:grid;place-items:center;font-family:Georgia,serif;font-size:20px}
.cta{background:var(--ink);color:#fff;border-radius:26px;padding:44px;display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap}
.cta h2{font-family:Georgia,serif;font-weight:400;font-size:30px;margin:0 0 6px;letter-spacing:-.02em}
.cta p{margin:0;color:#b9bcc6;font-size:14px}
.cta .btn{background:#fff;color:var(--ink);border-color:#fff}
footer{padding:34px 0 44px;color:var(--muted);font-size:12.5px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-top:1px solid var(--line);margin-top:56px}
.skeleton{border-radius:14px;background:linear-gradient(100deg,#eceae4 20%,#f6f4ee 40%,#eceae4 60%);background-size:220% 100%;animation:sh 1.6s linear infinite}
@keyframes sh{to{background-position:-220% 0}}
@media(max-width:900px){.hero{grid-template-columns:1fr;gap:34px;padding-top:48px}.grid,.steps{grid-template-columns:1fr}.nav-links{display:none}}
`;

function landingHtml(brand: string, level: number) {
  const services = [
    ["Skilled & work visas", "Employer-sponsored and points-based routes, prepared end to end."],
    ["Student & graduate", "Offer letters, funds evidence and visa lodgement without the guesswork."],
    ["Family & visitor", "Reunification, dependants and short-stay applications handled with care."],
  ];
  const steps = [
    ["Free eligibility check", "A 20-minute call to map your options and timelines."],
    ["Document strategy", "We build a checklist and evidence plan specific to your case."],
    ["Application lodgement", "Your consultant submits and tracks every milestone."],
    ["Landing support", "Arrival, housing and first-week guidance included."],
  ];
  const placeholders = (n: number) =>
    Array.from({ length: n })
      .map(() => '<div class="skeleton" style="height:120px"></div>')
      .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand} — Visas, without the guesswork</title>
<style>${LANDING_CSS}</style></head>
<body>
<header><div class="wrap nav">
  <div class="logo"><span class="logo-mark">${brand.slice(0, 1)}</span>${brand}</div>
  <nav class="nav-links"><a href="#services">Services</a><a href="#process">Process</a><a href="#stories">Stories</a><a href="#contact">Contact</a></nav>
  <a class="btn" href="#contact" style="padding:10px 18px">Book a free check</a>
</div></header>
<div class="wrap">
  <section class="hero">
    <div>
      <span class="eyebrow">● Trusted mobility advisory</span>
      <h1>Move forward,<br><em>borderless.</em></h1>
      <p class="lede">${brand} helps families and professionals secure work, study and family visas with a documented strategy — not a list of guesses.</p>
      <div class="actions"><a class="btn" href="#contact">Start free eligibility check</a><a class="btn ghost" href="#services">Explore services</a></div>
      <p class="note">No obligation · Response within one business day · Transparent fees</p>
    </div>
    <div class="visual">
      <div class="card"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8f9b">Case snapshot</div>
        <div style="margin-top:10px;font-family:Georgia,serif;font-size:22px;letter-spacing:-.01em">Skilled visa · Singapore</div>
        <div style="margin-top:14px">
          ${[["Eligibility", "Verified"], ["Documents", "12 / 12"], ["Lodged", "In review"]]
            .map(
              ([k, v]) =>
                `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:7px 0;border-top:1px solid #f0eee7"><span style="color:#8a8f9b">${k}</span><span style="font-weight:500">${v}</span></div>`,
            )
            .join("")}
        </div>
      </div>
      <div class="card" style="background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);color:#fff"><div style="font-size:12px;opacity:.85">Average preparation time</div><div style="font-family:Georgia,serif;font-size:28px">21 days</div></div>
      <div class="float"><span class="tick">✓</span><div><b style="font-size:12.5px">Application approved</b><div style="color:#8a8f9b;font-size:11.5px">Work pass · 24 months</div></div></div>
    </div>
  </section>
</div>
<div class="wrap"><div class="trust"><span>Regulated advisers</span><span>96% approval-ready</span><span>12 destination markets</span><span>Since 2014</span></div></div>
${
  level >= 2
    ? `<section class="section" id="services"><div class="wrap">
  <h2>Services built around your case</h2>
  <p class="sub">One consultant, one documented strategy, from the first call to your arrival checklist.</p>
  <div class="grid">${services
    .map(
      ([h, p], i) =>
        `<div class="service"><div class="icon">${["◆", "▲", "●"][i]}</div><h3>${h}</h3><p>${p}</p></div>`,
    )
    .join("")}</div></div></section>`
    : `<section class="section"><div class="wrap"><h2>Services</h2><p class="sub">Drafting service cards…</p><div class="grid">${placeholders(3)}</div></div></section>`
}
${
  level >= 3
    ? `<section class="section" id="process" style="background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)"><div class="wrap">
  <h2>A calm, four-step process</h2>
  <p class="sub">You always know what happens next — and what we still need from you.</p>
  <div class="steps">${steps.map(([h, p]) => `<div class="step"><h4>${h}</h4><p>${p}</p></div>`).join("")}</div>
</div></section>`
    : `<section class="section"><div class="wrap"><h2>Process</h2><p class="sub">Laying out the process…</p><div class="steps">${placeholders(4)}</div></div></section>`
}
${
  level >= 4
    ? `<section class="section" id="stories"><div class="wrap"><div class="quote">
  <div><blockquote>“They turned an impossible paperwork pile into a clear plan. I knew exactly which document was missing at every step.”</blockquote><cite>— Sample client story, skilled visa applicant</cite></div>
  <div class="avatar">A</div></div></div></section>`
    : `<section class="section"><div class="wrap"><div class="skeleton" style="height:150px"></div></div></section>`
}
${
  level >= 5
    ? `<section class="section" id="contact"><div class="wrap"><div class="cta">
  <div><h2>Your next chapter starts with a conversation.</h2><p>Book a free 20-minute eligibility check. No obligation, no jargon.</p></div>
  <a class="btn" href="mailto:hello@${brand.toLowerCase().replace(/[^a-z]/g, "")}.com">Book my free check</a>
</div>
<footer><span>© ${new Date().getFullYear()} ${brand}. Illustrative demo generated by Aster Agent.</span><span>Privacy · Terms · Client charter</span></footer>
</div></section>`
    : `<section class="section"><div class="wrap"><div class="skeleton" style="height:150px"></div></div></section>`
}
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Markdown artifacts                                                  */
/* ------------------------------------------------------------------ */

function visaMarkdown(level: number) {
  const parts = [
    `# Visa requirements — Bangladesh → Singapore

> **Important:** this is a structured starting point generated for planning. Entry rules change and depend on your passport, purpose and profile. Verify with the [Immigration & Checkpoints Authority](https://www.ica.gov.sg/) and the [Singapore Ministry of Foreign Affairs](https://www.mfa.gov.sg/) before paying for anything.

## 1. Summary

Bangladeshi passport holders generally need a visa to enter Singapore. Most short visits are applied for through an **authorised visa agent** or a Singapore overseas mission, and the outcome is usually a single- or multiple-entry visa tied to the visit.`,
  ];
  if (level >= 2)
    parts.push(`
## 2. Who applies and where

| Item | What to know |
| --- | --- |
| Visa needed? | Yes, for ordinary Bangladeshi passports |
| Typical channel | Authorised visa agent, or Singapore overseas mission |
| Application form | Form 14A (paper) / e-Visa application via the agent |
| Processing time | Commonly around 5–7 working days — confirm current times |
| Stay allowed | Set on the visa and at the checkpoint — do not assume a fixed length |
| Entry is not guaranteed | A visa is permission to travel, not a guaranteed entry |

## 3. Documents to prepare

- Passport valid for at least **six months** beyond the planned stay, with blank pages
- Completed Form 14A and recent passport-sized photograph to ICA spec
- Confirmed onward or return flight itinerary
- Proof of accommodation for the full stay
- Bank statements or sponsor evidence covering the trip
- Employer letter / leave approval (or school letter for students)
- For business visits: an invitation letter from the Singapore company
- Any prior Singapore visas or previous travel history

## 4. Practical checklist

1. Confirm your purpose of visit (tourism, family, business, study, work).
2. Choose an authorised visa agent and confirm the current fee in writing.
3. Assemble documents, keeping clear scans of every page.
4. Keep a copy of the visa and the submission receipt with your travel documents.
5. Check passport validity and name spelling match exactly across all documents.`);
  else parts.push(`\n_Section 2 (channels and document table) is being prepared…_\n`);
  if (level >= 3)
    parts.push(`
## 5. Risks and common refusal points

| Risk | Mitigation |
| --- | --- |
| Weak proof of funds | 3–6 months of statements plus a clear sponsor letter |
| Inconsistent travel dates | Match itinerary, accommodation and leave letter |
| Thin employment ties | Add a letter stating role, salary and approved leave |
| Unclear purpose | A short cover letter explaining the trip and host |
| Last-minute application | Apply at least 3–4 weeks before departure |

## 6. If your purpose is work or study

Tourist processing is not a substitute for an employment or student pass. Work pass eligibility is assessed by the employer through the relevant Singapore authority; student routes are assessed through the institution. Plan those tracks separately.`);
  else parts.push(`\n_Sections 5–6 (risks and work/study routes) are being prepared…_\n`);
  if (level >= 4)
    parts.push(`
## 7. Questions worth confirming before you submit

- Is your trip a single entry or will you need multiple entries?
- Does your visa agent provide a written fee breakdown and receipt?
- Are you travelling through a third country that needs a transit visa?
- Do you have a return ticket within the permitted stay?
- Is your passport valid for six months past the planned date?

## 8. Sources to verify

- ICA Singapore — visa requirements & authorised agents
- Singapore MFA — overseas missions
- Bangladesh Department of Immigration & Passports — passport validity and re-entry documents
- Your airline — transit visa rules for your routing`);
  if (level >= 5)
    parts.push(`
---

**Next step:** convert this into a tracked document checklist for a specific traveller. Run the agent again with the applicant's profile (age, employment, travel dates, sponsor) to produce a tailored pack.`);
  return parts.join("\n");
}

function researchMarkdown(brand: string, task: string, level: number) {
  const parts = [
    `# Competitor research framework
**Project:** ${task}
**Prepared for:** ${brand}

## Executive summary

This report gives you a decision-ready structure for mapping the competitive landscape. Where numbers are needed, the table marks them as **to validate** — the agent does not fabricate market data. Populate each cell during your research pass and the rest of the document stands as your analysis.

- The market clusters into **premium advisory**, **low-cost application support**, and **self-serve visa platforms**.
- Differentiation is won on **transparency of process**, not on price alone.
- Trust signals (documented outcomes, named consultants, clear fees) outperform generic claims.
- The fastest wedge is a **specific corridor** — one origin country, one destination, one purpose.`,
  ];
  if (level >= 2)
    parts.push(`
## Market context

| Dimension | Current pattern | What to validate |
| --- | --- | --- |
| Demand driver | Cross-border work and study mobility | Search volume by corridor |
| Buying trigger | Employer offer, admission letter, family event | Sales call notes |
| Decision maker | Applicant, sometimes an employer | Interview sample |
| Price sensitivity | High, but trust ranks above price | Price tests |
| Sales cycle | 1–4 weeks for advisory; longer for employer accounts | CRM data |

## Competitive set (archetypes, not claims)

| Archetype | Typical offer | Strengths | Gaps to exploit |
| --- | --- | --- | --- |
| Premium advisory firm | Full application management | Trust, outcomes | Opaque pricing, slow replies |
| Low-cost visa agent | Form filling and submission | Price | Little strategy, weak support |
| Self-serve platform | Checklists and templates | Speed | No human accountability |
| Recruitment + mobility hybrid | Job placement plus visa | Employer access | Weak candidate communication |

> Fill the names in yourself — the agent deliberately labels these as archetypes until verified sources are attached.`);
  else parts.push(`\n_Section 2 (market context) is being drafted…_\n`);
  if (level >= 3)
    parts.push(`
## Positioning map

| | Low transparency | High transparency |
| --- | --- | --- |
| **High touch** | Traditional agents | **Your opportunity** |
| **Low touch** | Classifieds | Self-serve tools |

## What to compare across competitors

1. Entry offer and first-call experience
2. Fee structure and refund policy
3. Stated processing times vs. reviews
4. Trust assets: case studies, named advisers, guarantees
5. Follow-up cadence and communication channel
6. Post-arrival services
7. Content depth for your corridor
8. Accessibility of pricing`);
  else parts.push(`\n_Section 3 (positioning) is being drafted…_\n`);
  if (level >= 4)
    parts.push(`
## Implications and recommended moves

| Priority | Move | Why it matters | Effort |
| --- | --- | --- | --- |
| 1 | Publish corridor-specific requirement pages | Wins high-intent search | Medium |
| 2 | Show a transparent fee schedule | Removes the biggest objection | Low |
| 3 | Package a documented "eligibility check" | Creates a low-risk first step | Medium |
| 4 | Collect structured client stories | Builds trust at scale | Medium |
| 5 | Add a tracked client checklist | Reduces support load | High |

## Research plan for the next pass

- Identify the top 8 competitors for your exact corridor.
- Run a mystery-shop enquiry with one question and log response time.
- Screenshot pricing pages for a dated record.
- Read 30 recent reviews and tag recurring complaints.
- Attach every source URL to the claim it supports.`);
  if (level >= 5)
    parts.push(`
---

## Appendix — sources to attach

- Company websites and pricing pages (dated screenshots)
- Review platforms and app stores
- Regulatory registers for advisers
- Search results for corridor keywords
- Your own enquiry transcripts

**Note:** this document provides a framework and sample structure. Replace every "to validate" item with a cited source before using it externally.`);
  return parts.join("\n");
}

function businessMarkdown(brand: string, level: number) {
  const parts = [
    `# Business plan — ${brand}

## 1. Executive summary

${brand} is a mobility and recruitment advisory built around documented processes, transparent fees and corridor focus. The plan covers the first 12 months: validate demand, package a repeatable service, then scale acquisition through content and partnerships.

- **Wedge:** one origin–destination corridor with high intent
- **Offer:** paid eligibility assessment → application management → arrival support
- **Model:** fixed-fee packages plus employer retainers
- **Proof:** tracked outcomes, not promises`,
  ];
  if (level >= 2)
    parts.push(`
## 2. Problem & customer

| Customer | Pain | Willingness to pay |
| --- | --- | --- |
| Individual applicant | Confusing rules, fear of refusal | High, if trust is earned |
| Family sponsor | Dependant documentation | High |
| Employer | Relocation friction, compliance risk | High, recurring |
| Student | Funds evidence and timelines | Medium |

## 3. Offer & packages

| Package | Contents | Price model |
| --- | --- | --- |
| Eligibility assessment | 30-min consult + written pathway | Fixed low fee |
| Application management | Documents, lodgement, tracking | Fixed + milestone |
| Employer retainer | Slots, compliance, candidate support | Monthly retainer |
| Arrival pack | Housing, SIM, onboarding | Add-on |`);
  else parts.push(`\n_Section 2 (customer and offer) is being prepared…_\n`);
  if (level >= 3)
    parts.push(`
## 4. Market sizing framework

| Layer | Definition | Your input |
| --- | --- | --- |
| TAM | All cross-border applicants from the corridor | _to validate_ |
| SAM | Applicants who pay for advisory | _to validate_ |
| SOM | Realistic 12-month capture | _to validate_ |

## 5. Go-to-market

- Corridor keyword pages with sourced requirement tables
- Short weekly briefing for prospective applicants
- Partnerships with employers, universities and relocation agents
- Referral loop: one documented case study per month
- Simple, honest pricing page — no "contact us to find out"`);
  else parts.push(`\n_Section 4 (market and GTM) is being prepared…_\n`);
  if (level >= 4)
    parts.push(`
## 6. Operations

| Function | First 90 days | Owner |
| --- | --- | --- |
| Client intake | Structured form + eligibility score | Founder |
| Case management | Shared checklist with client access | Ops lead |
| Submissions | SOP per destination | Consultant |
| QA | Second-reader check before submission | Founder |
| Finance | Deposit + milestone invoicing | Contractor |

## 7. Illustrative financial plan (model, not a forecast)

| Month | Assessments | Managed cases | Revenue (model) | Costs (model) |
| --- | --- | --- | --- | --- |
| 1–3 | 40 | 8 | _input your prices_ | _input your costs_ |
| 4–6 | 90 | 22 | | |
| 7–12 | 220 | 60 | | |

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Regulatory change | Monthly rule review; corridor diversification |
| Refusal rate | Eligibility-first funnel; QA before lodgement |
| Reputation | Published process and fee schedule; no guarantees |
| Cash flow | Deposit upfront + milestone billing |`);
  if (level >= 5)
    parts.push(`
---

**90-day plan:** launch one corridor page → run 20 assessments → convert 5 managed cases → publish two documented stories → add employer outreach. Review pricing at day 60 with real conversion data.`);
  return parts.join("\n");
}

function workflowMarkdown(level: number) {
  const parts = [
    `# Client follow-up automation blueprint

A practical, low-risk email workflow you can implement with any automation tool.

## Trigger

New enquiry received via the website form, WhatsApp link, or an email to the intake address.

## Sequence

| Step | Delay | Channel | Message intent |
| --- | --- | --- | --- |
| 1 | 0 min | Email | Confirm receipt and set expectations |
| 2 | 1 day | Email | Eligibility questions + booking link |
| 3 | 3 days | Email | Useful corridor guide, no hard sell |
| 4 | 7 days | Email | Offer a 20-minute call |
| 5 | 14 days | Email | Last check-in + close the loop |`,
  ];
  if (level >= 2)
    parts.push(`
## Email 1 — confirmation

\`\`\`text
Subject: We received your enquiry — here is what happens next

Hi {{first_name}},

Thank you for reaching out to {{brand}}. A consultant will review your
enquiry within one business day.

Next step: complete these five questions so we can prepare properly:
{{eligibility_form_url}}

— {{consultant_name}}, {{brand}}
\`\`\`

## Email 3 — corridor guide

\`\`\`text
Subject: {{destination}} requirements — a straight answer

Hi {{first_name}},

Most applicants are unsure about {{top_requirement}}.
This short guide covers documents, timelines and the most common delays:
{{guide_url}}

No obligation — reply with your travel dates and I will confirm your route.
\`\`\``);
  else parts.push(`\n_Email templates are being written…_\n`);
  if (level >= 3)
    parts.push(`
## Automation definition

\`\`\`json
{
  "name": "client-follow-up",
  "trigger": { "type": "form.submission", "source": "website" },
  "conditions": [
    { "field": "consent", "equals": true }
  ],
  "steps": [
    { "type": "email", "template": "confirm", "delayMinutes": 0 },
    { "type": "email", "template": "eligibility", "delayMinutes": 1440 },
    { "type": "condition", "field": "booked_call", "then": "stop", "else": "continue" },
    { "type": "email", "template": "guide", "delayMinutes": 4320 },
    { "type": "tag", "value": "nurture" }
  ],
  "exitOnReply": true,
  "quietHours": { "start": "20:00", "end": "07:30", "timezone": "Asia/Dhaka" }
}
\`\`\``);
  else parts.push(`\n_Automation definition is being generated…_\n`);
  if (level >= 4)
    parts.push(`
## Guardrails

- Stop all follow-ups the moment the contact replies.
- Send only during business hours in the contact's timezone.
- Keep a single unsubscribe link in every message.
- Never include passport or document numbers in email bodies.
- Log consent text and timestamp before the first automated send.

## Metrics

| Metric | Target | How to measure |
| --- | --- | --- |
| Reply rate | > 18% | Replies ÷ sent |
| Call bookings | > 6% | Bookings ÷ sent |
| Unsubscribe | < 1% | Opt-outs ÷ sent |
| Time to first contact | < 1 business day | Timestamp diff |`);
  if (level >= 5)
    parts.push(`
---

**Rollout:** connect the form → send Email 1 manually for a week → review tone → enable the remaining steps → check metrics weekly for the first month.`);
  return parts.join("\n");
}

function generalMarkdown(task: string, level: number) {
  const parts = [
    `# ${topicFor(task).replace(/^./, (c) => c.toUpperCase())}

## Overview

This working document is being produced by the agent in stages. It follows a simple structure: context, what matters, a plan, and the checks needed before anything ships.

- **Task:** ${task}
- **Approach:** structured research → synthesis → production → review
- **Output:** an editable markdown document plus downloadable files`,
  ];
  if (level >= 2) parts.push(`\n## Context\n\nAdd the audience, constraints and any sources you already trust. The agent keeps placeholders explicit instead of inventing facts.\n\n| Item | Value |\n| --- | --- |\n| Audience | To confirm |\n| Success measure | To confirm |\n| Deadline | To confirm |`);
  if (level >= 3) parts.push(`\n## What matters\n\n1. Clarity of the outcome\n2. Evidence behind each claim\n3. A visible process your audience can trust\n4. A clear next step`);
  if (level >= 4) parts.push(`\n## Plan\n\n| Phase | Work | Deliverable |\n| --- | --- | --- |\n| 1 | Clarify scope | One-page brief |\n| 2 | Research | Sourced notes |\n| 3 | Draft | This document |\n| 4 | Review | Checklist + final pack |\n\n## Review checklist\n\n- Every number has a source or is labelled as an estimate\n- Tone matches the audience\n- No policy or eligibility claim left unverified\n- Next step is explicit`);
  if (level >= 5) parts.push(`\n---\n\n**Done.** Edit any section above, or ask the agent for a follow-up revision.`);
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* Artifact assembly                                                   */
/* ------------------------------------------------------------------ */

function outlineOf(markdown: string) {
  return markdown
    .split("\n")
    .map((l) => l.match(/^(#{1,3})\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ level: m![1].length, text: m![2] }));
}

export function buildArtifact(task: string, intent: Intent, level: number): Artifact {
  const brand = brandFor(task, intent);
  const now = Date.now();

  if (intent === "landing") {
    const html = landingHtml(brand, level);
    const files: ArtifactFile[] = [
      { name: "index.html", mime: "text/html", content: html },
      { name: "copy.md", mime: "text/markdown", content: landingCopy(brand) },
      { name: "README.md", mime: "text/markdown", content: `# ${brand} landing page\n\nGenerated by Aster Agent on ${new Date().toLocaleDateString()}.\n\n## Files\n- \`index.html\` — single-file page, no build step\n- \`copy.md\` — all page copy for editing\n\n## Deploy\nDrop \`index.html\` on any static host (Netlify, Vercel, Cloudflare Pages, S3).\n` },
    ];
    return {
      kind: "html",
      title: `${brand} — landing page`,
      language: "html",
      filename: "index.html",
      content: html,
      files,
      outline: [
        { level: 1, text: "Navigation & hero" },
        { level: 2, text: "Services" },
        { level: 2, text: "Process" },
        { level: 2, text: "Testimonial" },
        { level: 2, text: "Final call to action" },
        { level: 3, text: "Footer" },
      ],
      updatedAt: now,
    };
  }

  let md = "";
  let title = "";
  if (intent === "visa") {
    md = visaMarkdown(level);
    title = "Visa requirements — Bangladesh → Singapore";
  } else if (intent === "research") {
    md = researchMarkdown(brand, task, level);
    title = "Competitor research report";
  } else if (intent === "business") {
    md = businessMarkdown(brand, level);
    title = `${brand} — business plan`;
  } else if (intent === "workflow") {
    md = workflowMarkdown(level);
    title = "Client follow-up automation blueprint";
  } else {
    md = generalMarkdown(task, level);
    title = topicFor(task).slice(0, 60);
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "result";
  return {
    kind: "markdown",
    title,
    language: "markdown",
    filename: `${slug}.md`,
    content: md,
    outline: outlineOf(md),
    files: [
      { name: `${slug}.md`, mime: "text/markdown", content: md },
      { name: "summary.txt", mime: "text/plain", content: summaryOf(md) },
    ],
    updatedAt: now,
  };
}

function landingCopy(brand: string) {
  return `# ${brand} — page copy

## Hero
Headline: Move forward, borderless.
Sub: ${brand} helps families and professionals secure work, study and family visas with a documented strategy.

## Services
1. Skilled & work visas
2. Student & graduate routes
3. Family & visitor visas

## Process
1. Free eligibility check
2. Document strategy
3. Application lodgement
4. Landing support

## CTA
Your next chapter starts with a conversation. Book a free 20-minute eligibility check.
`;
}

function summaryOf(md: string) {
  const plain = md
    .replace(/```[\s\S]*?```/g, "[code block]")
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, 600) + "…\n";
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

const PLAN_TEMPLATE: { title: string; description: string; tools: string[]; requiresApproval?: boolean }[] = [
  { title: "Understanding request", description: "Parse the goal, audience and constraints; choose an output format.", tools: ["intent_classifier", "brief_writer"] },
  { title: "Researching", description: "Gather relevant context, patterns and source material.", tools: ["web_research", "knowledge_base"] },
  { title: "Collecting information", description: "Structure findings into evidence, requirements and gaps.", tools: ["extractor", "fact_labeler"], requiresApproval: true },
  { title: "Creating structure", description: "Draft the outline, sections and content hierarchy.", tools: ["outline_builder", "copy_planner"] },
  { title: "Generating output", description: "Write and build the actual artifact in the live preview.", tools: ["writer", "html_builder"], requiresApproval: true },
  { title: "Reviewing result", description: "Check clarity, evidence, accessibility and download integrity.", tools: ["critic", "link_checker"] },
];

export function createRun(task: string, userId: string, autoApprove: boolean): AgentRun {
  const intent = detectIntent(task);
  const steps: AgentStep[] = PLAN_TEMPLATE.map((s, i) => ({
    id: `step_${i + 1}`,
    title: s.title,
    description: s.description,
    status: "pending",
    tools: s.tools,
    logs: [],
    requiresApproval: !!s.requiresApproval,
  }));
  return {
    id: uid("run"),
    userId,
    task,
    mode: "agent",
    status: "thinking",
    steps,
    artifact: buildArtifact(task, intent, 0),
    logs: [log(`Plan created with ${steps.length} steps`, "success")],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    endedAt: null,
    currentStepId: null,
    autoApprove,
    followUps: [],
    projectId: null,
  };
}

const STATUS_BY_STEP: AgentStatus[] = ["thinking", "researching", "researching", "building", "writing", "reviewing"];
export { STATUS_BY_STEP };

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface EngineHooks {
  onChange: (run: AgentRun) => void;
  onComplete?: (run: AgentRun) => void;
}

export class AgentEngine {
  private run: AgentRun;
  private paused = false;
  private stopped = false;
  private approval: { stepId: string; decision: "approve" | "reject" } | null = null;
  private intent: Intent;
  private revision = 0;

  constructor(run: AgentRun, private hooks: EngineHooks) {
    this.run = run;
    this.intent = detectIntent(run.task);
  }

  get state() {
    return this.run;
  }

  private emit(patch: Partial<AgentRun> = {}) {
    this.run = { ...this.run, ...patch, updatedAt: Date.now() };
    this.hooks.onChange(this.run);
  }

  private patchStep(stepId: string, patch: Partial<AgentStep>) {
    this.emit({ steps: this.run.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) });
  }

  private addLog(stepId: string | null, text: string, tone: LogLine["tone"] = "info") {
    const line = log(text, tone);
    this.emit({
      logs: [...this.run.logs, line].slice(-160),
      steps: stepId
        ? this.run.steps.map((s) => (s.id === stepId ? { ...s, logs: [...s.logs, line].slice(-40) } : s))
        : this.run.steps,
    });
  }

  private waitIfPaused = async () => {
    while (this.paused && !this.stopped) await sleep(140);
  };

  pause() {
    if (this.stopped) return;
    this.paused = true;
    this.emit({ status: "paused" });
    this.addLog(this.run.currentStepId, "Agent paused by user", "warn");
  }

  resume() {
    if (this.stopped) return;
    this.paused = false;
    this.emit({ status: this.run.currentStepId ? STATUS_BY_STEP[Number(this.run.currentStepId.split("_")[1]) - 1] : "thinking" });
    this.addLog(this.run.currentStepId, "Agent resumed", "info");
  }

  stop() {
    this.stopped = true;
    this.paused = false;
    const current = this.run.currentStepId;
    if (current) this.patchStep(current, { status: "skipped", endedAt: Date.now() });
    this.emit({ status: "stopped", endedAt: Date.now(), currentStepId: null });
    this.addLog(current, "Agent stopped by user", "warn");
    this.hooks.onComplete?.(this.run);
  }

  approve(stepId: string) {
    this.approval = { stepId, decision: "approve" };
  }

  reject(stepId: string) {
    this.approval = { stepId, decision: "reject" };
  }

  async start() {
    try {
      for (let i = 0; i < this.run.steps.length; i++) {
        if (this.stopped) return;
        await this.waitIfPaused();
        const step = this.run.steps[i];
        const level = i + 1;
        this.emit({ currentStepId: step.id, status: STATUS_BY_STEP[i] });
        this.patchStep(step.id, { status: "active", startedAt: Date.now() });
        this.addLog(step.id, `Step ${level}: ${step.title}`, "info");
        await sleep(420);
        await this.executeStep(step, level, i);
        if (this.stopped) return;

        if (step.requiresApproval && !this.run.autoApprove) {
          this.emit({ status: "awaiting_approval" });
          this.patchStep(step.id, { status: "awaiting_approval" });
          this.addLog(step.id, "Waiting for your approval to continue", "warn");
          while (!this.approval && !this.stopped) await sleep(160);
          if (this.stopped) return;
          const decision = this.approval!.decision;
          this.approval = null;
          if (decision === "reject") {
            this.revision += 1;
            this.patchStep(step.id, { status: "active" });
            this.addLog(step.id, "Revision requested — reworking this step", "warn");
            await sleep(400);
            await this.executeStep(step, level, i, true);
          }
          this.patchStep(step.id, { status: "done", endedAt: Date.now() });
          this.addLog(step.id, decision === "reject" ? "Step completed after revision" : "Step approved", "success");
        } else {
          this.patchStep(step.id, { status: "done", endedAt: Date.now() });
        }

        this.emit({
          artifact: buildArtifact(this.run.task, this.intent, Math.min(5, level)),
          status: level >= 5 ? "reviewing" : STATUS_BY_STEP[Math.min(5, i + 1)],
        });
        await sleep(340);
      }

      if (this.stopped) return;
      const finalArtifact = buildArtifact(this.run.task, this.intent, 5);
      this.emit({
        status: "completed",
        artifact: finalArtifact,
        endedAt: Date.now(),
        currentStepId: null,
      });
      this.addLog(null, `Done — ${finalArtifact.files.length} files ready to download`, "success");
      this.hooks.onComplete?.(this.run);
    } catch (e) {
      this.emit({ status: "failed", error: e instanceof Error ? e.message : "Agent failed", endedAt: Date.now() });
      this.addLog(this.run.currentStepId, e instanceof Error ? e.message : "Agent failed", "error");
      this.hooks.onComplete?.(this.run);
    }
  }

  private async executeStep(step: AgentStep, level: number, index: number, revision = false) {
    const tool = step.tools[revision ? step.tools.length - 1 : 0] ?? "agent";
    this.addLog(step.id, `Using tool: ${tool}`, "tool");

    const lines: [string, LogLine["tone"]][] =
      this.intent === "landing"
        ? [
            ["Reading the brief and choosing a visual direction", "info"],
            ["Writing the headline and hero section", "info"],
            ["Composing service cards and process copy", "info"],
            ["Assembling responsive HTML and layout tokens", "info"],
            ["Checking contrast, spacing and mobile breakpoints", "success"],
          ]
        : this.intent === "visa"
          ? [
              ["Identifying corridor and traveller profile", "info"],
              ["Checking current entry guidance from official sources", "info"],
              ["Building the document checklist table", "info"],
              ["Labelling every unverified claim explicitly", "warn"],
              ["Cross-checking risk notes against the checklist", "success"],
            ]
          : [
              ["Breaking the task into concrete questions", "info"],
              ["Gathering reference material and patterns", "info"],
              ["Structuring findings into sections and tables", "info"],
              ["Drafting the narrative for each section", "info"],
              ["Reviewing evidence, tone and next steps", "success"],
            ];

    for (let i = 0; i < lines.length; i++) {
      if (this.stopped) return;
      await this.waitIfPaused();
      await sleep(300 + Math.random() * 360);
      this.addLog(step.id, lines[i][0], lines[i][1]);
      if (i === Math.floor(lines.length / 2)) {
        this.emit({ artifact: buildArtifact(this.run.task, this.intent, Math.max(0, level - 1)) });
      }
    }
    void index;
  }
}
