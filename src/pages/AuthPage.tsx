import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, Moon, Sparkles, Sun, Zap, ShieldCheck, Boxes } from "lucide-react";
import { useState } from "react";
import { Button, Logo, inputCls } from "@/components/ui";
import { useApp } from "@/lib/store";
import { cn } from "@/utils/cn";

export default function AuthPage() {
  const { signIn, signUp, googleSignIn, enterDemo, settings, toggleTheme, pushToast } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    const err = mode === "in" ? await signIn(email, password) : await signUp(name, email, password);
    setBusy(false);
    if (err) setError(err);
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    const err = await googleSignIn();
    setBusy(false);
    if (err) setError(err);
    else {
      setNote("Signed in with a demo Google account. No external identity provider was contacted.");
      pushToast("Google sign-in (demo) succeeded", "ok");
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full overflow-y-auto bg-[var(--bg)]">
      {/* left brand panel */}
      <div className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden border-r border-[rgb(var(--line))] p-10 lg:flex">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-60" />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(108,92,231,0.22),transparent_65%)] blur-2xl" />
        <div className="relative flex items-center gap-2.5">
          <Logo size={34} />
          <span className="text-[17px] font-semibold tracking-[-0.03em] text-pri">
            Aster<span className="text-[var(--accent)]">.</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--text)/0.03)] px-3 py-1 text-[11.5px] font-medium text-sec">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" /> Chat and Agent in one quiet workspace
          </div>
          <h1 className="serif text-[44px] leading-[1.06] tracking-[-0.02em] text-pri">
            Ask anything.
            <br />
            <span className="text-[var(--accent)]">Or hand off the work.</span>
          </h1>
          <p className="mt-5 text-[14.5px] leading-relaxed text-sec">
            Aster answers instantly in Chat — or plans, researches and builds a real deliverable in Agent mode, with a live preview you
            can watch and download.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: Zap, text: "Chat: instant answers, streaming markdown and code" },
              { icon: Boxes, text: "Agent: visible plan, live logs, real output preview" },
              { icon: ShieldCheck, text: "Yours: local workspace, exports and usage controls" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-2.5 text-[13px] text-sec">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[rgb(var(--line))] bg-[var(--bg-elevated)] text-[var(--accent)]">
                  <f.icon className="h-3.5 w-3.5" />
                </span>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11.5px] text-ter">AI can make mistakes. Verify important information.</p>
      </div>

      {/* form */}
      <div className="relative flex min-h-[100dvh] flex-1 flex-col p-5 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Logo size={30} />
            <span className="text-[15.5px] font-semibold tracking-[-0.03em] text-pri">
              Aster<span className="text-[var(--accent)]">.</span>
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="ml-auto grid h-9 w-9 place-items-center rounded-[10px] border border-[rgb(var(--line))] bg-[var(--bg-elevated)] text-sec transition-colors hover:text-pri"
            aria-label="Toggle theme"
          >
            {settings.theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 30 }} className="w-full max-w-[400px]">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-pri">{mode === "in" ? "Welcome back" : "Create your account"}</h2>
            <p className="mt-1.5 text-[13.5px] text-sec">{mode === "in" ? "Sign in to your personal AI workspace." : "One account, chat and agent runs included."}</p>

            <form onSubmit={submit} className="mt-7 space-y-3.5">
              {mode === "up" && (
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-sec">Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} autoComplete="name" />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-sec">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} autoComplete="email" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-sec">Password</label>
                <div className="relative">
                  <input
                    type={reveal ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "up" ? "At least 6 characters" : "Your password"}
                    className={cn(inputCls, "pr-10")}
                    autoComplete={mode === "in" ? "current-password" : "new-password"}
                  />
                  <button type="button" onClick={() => setReveal((r) => !r)} aria-label="Toggle password visibility" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ter hover:text-pri">
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg border border-[rgb(229_72_77/0.28)] bg-[rgb(229_72_77/0.07)] px-3 py-2 text-[12.5px] text-[#b3353a] dark:text-[#ff9a9d]">
                    {error}
                  </motion.p>
                )}
                {note && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-[rgb(16_185_129/0.28)] bg-[rgb(16_185_129/0.07)] px-3 py-2 text-[12px] text-[#0f7a56] dark:text-[#5ee0aa]">
                    {note}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full" icon={!busy ? <ArrowRight className="h-4 w-4" /> : undefined}>
                {mode === "in" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-[rgb(var(--line))]" />
              <span className="text-[11px] font-medium tracking-wide text-ter uppercase">or</span>
              <span className="h-px flex-1 bg-[rgb(var(--line))]" />
            </div>

            <button
              onClick={google}
              disabled={busy}
              className="ring-focus flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] text-[13.5px] font-medium text-pri transition-colors hover:bg-[rgb(var(--text)/0.03)] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.29 9.14 5.38 12 5.38Z" />
              </svg>
              Continue with Google
            </button>

            <div className="mt-5 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--text)/0.025)] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-ter uppercase">
                <Sparkles className="h-3 w-3" /> Try it instantly
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => enterDemo(true)} icon={<Check className="h-3.5 w-3.5" />}>
                  Admin demo
                </Button>
                <Button size="sm" variant="secondary" onClick={() => enterDemo(false)}>
                  User demo
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ter">
                Admin demo: <span className="font-medium text-sec">admin@aster.ai</span> / <span className="font-medium text-sec">aster123</span> · Google
                sign-in is simulated locally in this build.
              </p>
            </div>

            <p className="mt-5 text-center text-[12.5px] text-sec">
              {mode === "in" ? "New to Aster?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError(null);
                }}
                className="font-medium text-[var(--accent)] hover:underline"
              >
                {mode === "in" ? "Create an account" : "Sign in"}
              </button>
            </p>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-ter">AI can make mistakes. Verify important information.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
