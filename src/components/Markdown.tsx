import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/utils/cn";

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const mm = t.match(/\[([^\]]+)\]\(([^)]+)\)/);
      out.push(
        <a key={k} href={mm?.[2]} target="_blank" rel="noreferrer noopener">
          {mm?.[1] ?? t}
        </a>,
      );
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Code({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(code).then(done).catch(done);
    else done();
  };
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[rgb(var(--line))] bg-[var(--code-bg)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/40">{lang || "code"}</span>
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-white/55 hover:text-white">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="thin-scroll overflow-x-auto px-4 py-3 text-[12.5px] leading-relaxed" style={{ color: "var(--code-text)" }}>
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

export default function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/```/);
  const out: React.ReactNode[] = [];

  blocks.forEach((block, bi) => {
    if (bi % 2 === 1) {
      const nl = block.indexOf("\n");
      const lang = nl > -1 ? block.slice(0, nl).trim() : "";
      const code = nl > -1 ? block.slice(nl + 1) : block;
      out.push(<Code key={`c-${bi}`} code={code.replace(/\n$/, "")} lang={lang} />);
      return;
    }

    let list: { type: "ul" | "ol"; items: string[] } | null = null;
    let table: string[][] | null = null;

    const flushList = () => {
      if (!list) return;
      const Tag = list.type;
      out.push(
        React.createElement(
          Tag,
          { key: `l-${bi}-${out.length}` },
          list.items.map((it, ii) => <li key={ii}>{inline(it, `li-${bi}-${ii}`)}</li>),
        ),
      );
      list = null;
    };
    const flushTable = () => {
      if (!table) return;
      const [head, ...rows] = table;
      out.push(
        <div key={`tb-${bi}-${out.length}`} className="thin-scroll my-2 overflow-x-auto">
          <table>
            <thead>
              <tr>{head.map((h, i) => <th key={i}>{inline(h, `th-${i}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c.trim())))
                .map((r, ri) => (
                  <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `td-${ri}-${ci}`)}</td>)}</tr>
                ))}
            </tbody>
          </table>
        </div>,
      );
      table = null;
    };

    block.split("\n").forEach((raw, li) => {
      const line = raw.trimEnd();
      if (/^\s*\|.*\|\s*$/.test(line)) {
        flushList();
        table = table ?? [];
        table.push(line.trim().slice(1, -1).split("|").map((c) => c.trim()));
        return;
      }
      flushTable();

      const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
      const ul = line.match(/^\s*[-*+]\s+(.*)$/);
      if (ol) {
        if (!list || list.type !== "ol") {
          flushList();
          list = { type: "ol", items: [] };
        }
        list.items.push(ol[2]);
        return;
      }
      if (ul) {
        if (!list || list.type !== "ul") {
          flushList();
          list = { type: "ul", items: [] };
        }
        list.items.push(ul[1]);
        return;
      }
      flushList();
      if (!line.trim()) return;

      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        const level = Math.min(3, h[1].length);
        const Tag = `h${level}` as "h1" | "h2" | "h3";
        out.push(<Tag key={`h-${bi}-${li}`}>{inline(h[2], `h-${bi}-${li}`)}</Tag>);
        return;
      }
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        out.push(<hr key={`hr-${bi}-${li}`} />);
        return;
      }
      if (/^>\s?/.test(line)) {
        out.push(<blockquote key={`q-${bi}-${li}`}>{inline(line.replace(/^>\s?/, ""), `q-${bi}-${li}`)}</blockquote>);
        return;
      }
      out.push(<p key={`p-${bi}-${li}`}>{inline(line, `p-${bi}-${li}`)}</p>);
    });
    flushList();
    flushTable();
  });

  return <div className={cn("md", className)}>{out}</div>;
}
