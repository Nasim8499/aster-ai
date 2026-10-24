import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Loader2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

/* ---------------- Brand ---------------- */

export function Logo({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[11px] bg-[linear-gradient(150deg,#8b7cff_0%,#6c5ce7_45%,#4c3fc4_100%)] shadow-[0_8px_20px_-10px_rgba(108,92,231,0.9),inset_0_1px_0_rgba(255,255,255,0.4)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="absolute -top-2 left-0 h-4 w-10 rotate-[-20deg] bg-white/30 blur-[4px]" />
      <svg viewBox="0 0 24 24" fill="currentColor" className="relative text-white" style={{ width: size * 0.58, height: size * 0.58 }}>
        <path d="M12 2.2c.55 3.36 1.9 5.55 4.02 6.65 1.16.6 2.5.98 3.98 1.15-3.2.62-5.36 1.9-6.5 3.86-.68 1.16-1.13 2.6-1.5 4.32-.6-3.2-1.87-5.32-3.8-6.44C7.02 10.9 5.6 10.45 3.8 10.1c3.2-.6 5.34-1.88 6.47-3.84C11 5.1 11.47 3.7 12 2.2Z" />
        <circle cx="18.4" cy="17.9" r="2.1" opacity="0.85" />
        <circle cx="6.2" cy="18.6" r="1.1" opacity="0.7" />
      </svg>
    </div>
  );
}

export function Wordmark({ sub, className }: { sub?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={30} />
      <div className="leading-none">
        <div className="text-[15.5px] font-semibold tracking-[-0.03em] text-pri">
          Aster<span className="text-[var(--accent)]">.</span>
        </div>
        {sub && <div className="mt-1 text-[10px] font-medium tracking-[0.14em] text-ter uppercase">{sub}</div>}
      </div>
    </div>
  );
}

export function Avatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${color ?? "#6c5ce7"}, ${color ?? "#6c5ce7"}cc)`,
        fontSize: size * 0.36,
      }}
    >
      {initials || "A"}
    </div>
  );
}

/* ---------------- Buttons ---------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: React.ReactNode;
};

export function Button({ variant = "secondary", size = "md", loading, icon, children, className, disabled, ...rest }: ButtonProps) {
  const sizes = {
    sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-lg",
    md: "h-9.5 px-4 text-[13.5px] gap-2 rounded-[10px]",
    lg: "h-11 px-5 text-[14px] gap-2 rounded-xl",
    icon: "h-9 w-9 rounded-[10px]",
  }[size];
  const variants = {
    primary: "ink-btn shadow-sm-soft",
    accent: "bg-[var(--accent)] text-white hover:opacity-90 shadow-sm-soft",
    secondary: "surface-solid text-pri hover:bg-[rgb(var(--text)/0.04)] shadow-sm-soft",
    ghost: "text-sec hover:text-pri hover:bg-[rgb(var(--text)/0.05)]",
    danger: "bg-[#e5484d] text-white hover:opacity-90",
  }[variant];
  return (
    <button
      disabled={disabled || loading}
      className={cn("ring-focus inline-flex shrink-0 items-center justify-center font-medium tracking-[-0.01em] transition-all disabled:pointer-events-none disabled:opacity-45", sizes, variants, className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  active,
  className,
  size = 34,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; size?: number }) {
  return (
    <button
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={cn(
        "ring-focus grid shrink-0 place-items-center rounded-[9px] text-sec transition-colors hover:bg-[rgb(var(--text)/0.06)] hover:text-pri disabled:opacity-40",
        active && "bg-[var(--accent-soft)] text-[var(--accent)]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Switch / segmented ---------------- */

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("ring-focus relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-300 disabled:opacity-40", checked ? "bg-[var(--accent)]" : "bg-[rgb(var(--text)/0.16)]")}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 34 }} className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]" style={{ left: checked ? 18 : 2 }} />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = React.useId();
  return (
    <div className={cn("relative inline-flex rounded-[10px] border border-[rgb(var(--line))] bg-[rgb(var(--text)/0.035)] p-[3px]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "ring-focus relative z-10 inline-flex items-center justify-center gap-1.5 rounded-[7px] font-medium transition-colors",
              size === "sm" ? "px-2.5 py-[4px] text-[12px]" : "px-3.5 py-[6px] text-[13px]",
              active ? "text-pri" : "text-ter hover:text-sec",
            )}
          >
            {active && (
              <motion.span
                layoutId={`sg-${id}`}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 -z-10 rounded-[7px] bg-[var(--surface-solid)] shadow-[0_1px_3px_rgba(16,16,24,0.12),0_0_0_1px_rgb(var(--line))]"
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Inputs ---------------- */

export const inputCls =
  "ring-focus w-full rounded-[10px] border border-[rgb(var(--line))] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-[13.5px] text-pri placeholder:text-ter transition-colors";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "resize-none", props.className)} />;
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "cursor-pointer appearance-none py-2 pr-8 text-[13px]")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-ter" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Field({ label, hint, children, right }: { label: string; hint?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-sec">{label}</span>
        {right}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ter">{hint}</p>}
    </label>
  );
}

/* ---------------- Feedback ---------------- */

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "accent" | "green" | "red" | "amber"; className?: string }) {
  const tones = {
    neutral: "border-[rgb(var(--line))] bg-[rgb(var(--text)/0.03)] text-sec",
    accent: "border-[rgb(108_92_231/0.24)] bg-[rgb(108_92_231/0.08)] text-[var(--accent)]",
    green: "border-[rgb(16_185_129/0.26)] bg-[rgb(16_185_129/0.08)] text-[#0f9f6e] dark:text-[#4ade9f]",
    red: "border-[rgb(229_72_77/0.26)] bg-[rgb(229_72_77/0.08)] text-[#d13a3f] dark:text-[#ff8a8e]",
    amber: "border-[rgb(245_158_11/0.28)] bg-[rgb(245_158_11/0.09)] text-[#a16207] dark:text-[#fbbf24]",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-[7px] border px-2 py-[3px] text-[11px] font-medium tracking-[-0.005em]", tones, className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}

export function EmptyState({ icon, title, description, action, compact }: { icon: React.ReactNode; title: string; description: React.ReactNode; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "p-6" : "p-10")}>
      <div className={cn("mb-4 grid place-items-center rounded-2xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] text-[var(--accent)] shadow-sm-soft", compact ? "h-11 w-11" : "h-14 w-14")}>{icon}</div>
      <h3 className={cn("font-semibold tracking-[-0.02em] text-pri", compact ? "text-[14px]" : "text-[16px]")}>{title}</h3>
      <p className={cn("mx-auto mt-1.5 max-w-sm leading-relaxed text-ter", compact ? "text-[12px]" : "text-[13px]")}>{description}</p>
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, onRetry, compact }: { children: React.ReactNode; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[10px] border border-[rgb(229_72_77/0.28)] bg-[rgb(229_72_77/0.06)]", compact ? "p-2.5" : "p-3.5")}>
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#e5484d] text-[10px] font-bold text-white">!</span>
      <p className="flex-1 text-[12.5px] leading-relaxed text-[#b3353a] dark:text-[#ff9a9d]">{children}</p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 text-[12px] font-medium text-[#b3353a] underline underline-offset-2 dark:text-[#ff9a9d]">
          Retry
        </button>
      )}
    </div>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0b0b10]/40 backdrop-blur-[3px]" />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cn("relative w-full overflow-hidden rounded-2xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] shadow-lg-soft", wide ? "max-w-2xl" : "max-w-md")}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[rgb(var(--line))] px-5 py-3.5">
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-pri">{title}</div>
              <IconButton label="Close" onClick={onClose} size={28}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-[rgb(var(--line))] bg-[rgb(var(--text)/0.02)] px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ToastHost({ toast }: { toast: { id: string; text: string; tone: "ok" | "err" | "info" } | null }) {
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 px-3">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="flex max-w-[90vw] items-center gap-2.5 rounded-full border border-[rgb(var(--line))] bg-[var(--bg-elevated)] px-4 py-2.5 shadow-lg-soft"
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toast.tone === "ok" ? "bg-[#10b981]" : toast.tone === "err" ? "bg-[#e5484d]" : "bg-[var(--accent)]")} />
            <span className="text-[12.5px] font-medium text-pri">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- misc hooks ---------------- */

export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const copy = (text: string) => {
    const done = () => {
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), timeout);
    };
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(text).then(done).catch(done);
    else done();
  };
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return { copied, copy };
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const { copied, copy } = useCopy();
  return (
    <button onClick={() => copy(text)} className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-ter transition-colors hover:bg-[rgb(var(--text)/0.05)] hover:text-pri", className)}>
      {copied ? <Check className="h-3 w-3 text-[#10b981]" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function ProgressRing({ value, size = 34 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--text) / 0.1)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (Math.min(100, Math.max(0, value)) / 100) * c} className="transition-all duration-500" />
    </svg>
  );
}
