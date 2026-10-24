import { motion } from "framer-motion";
import { ArrowRight, Check, CreditCard, Download, Sparkles, Zap } from "lucide-react";
import { Badge, Button, ProgressRing } from "@/components/ui";
import { useApp } from "@/lib/store";
import { PLANS } from "@/lib/types";
import { cn } from "@/utils/cn";
import { fullDate } from "@/lib/format";

export default function PlansPage() {
  const { planId, upgrade, usage, limits, user, exportData, pushToast } = useApp();

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-pri">Plans & usage</h1>
          <p className="mt-1 text-[13px] text-sec">Monthly limits reset automatically. Billing is simulated in this build — no card is charged.</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <ProgressRing value={Math.min(100, (usage.chat / limits.chat) * 100)} size={44} />
              <div>
                <div className="text-[13px] font-semibold text-pri">Chat usage</div>
                <div className="text-[11.5px] text-ter">{usage.chat} of {limits.chat} messages this month</div>
              </div>
            </div>
            <div className="hidden h-10 w-px bg-[rgb(var(--line))] sm:block" />
            <div className="flex items-center gap-3">
              <ProgressRing value={Math.min(100, (usage.agent / limits.agent) * 100)} size={44} />
              <div>
                <div className="text-[13px] font-semibold text-pri">Agent usage</div>
                <div className="text-[11.5px] text-ter">{usage.agent} of {limits.agent} runs this month</div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge tone="accent">{PLANS.find((p) => p.id === planId)?.name} plan</Badge>
              <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={exportData}>Export data</Button>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-3 md:grid-cols-3">
          {PLANS.map((plan, i) => {
            const current = plan.id === planId;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "relative flex flex-col rounded-xl border bg-[var(--bg-elevated)] p-4 shadow-sm-soft",
                  current ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/15" : "border-[rgb(var(--line))]",
                )}
              >
                {current && <span className="absolute -top-2 right-3 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium text-white">Current plan</span>}
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-pri">{plan.name}</span>
                  {plan.id === "pro" && <Badge tone="accent">Popular</Badge>}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[28px] font-semibold tracking-[-0.03em] text-pri">{plan.price}</span>
                  <span className="text-[11.5px] text-ter">/ month</span>
                </div>
                <p className="mt-1 text-[11.5px] text-ter">{plan.tagline}</p>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px] leading-relaxed text-sec">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#10b981]" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={current ? "secondary" : plan.id === "free" ? "secondary" : "primary"}
                  className="mt-4 w-full"
                  icon={plan.id === "free" ? undefined : <Sparkles className="h-3.5 w-3.5" />}
                  onClick={() => upgrade(plan.id)}
                  disabled={current}
                >
                  {current ? "Your current plan" : plan.id === "free" ? "Switch to Free" : <>Choose {plan.name} <ArrowRight className="h-3.5 w-3.5" /></>}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
            <div className="mb-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-[13px] font-semibold text-pri">Billing</h2>
            </div>
            <p className="text-[12px] leading-relaxed text-ter">
              Plan changes apply instantly and reset usage limits for the selected tier. Payment processing and invoices are not connected in
              this demo build — wire Stripe or Paddle on the server to enable real billing.
            </p>
            <div className="mt-3 space-y-1.5 text-[12px]">
              <div className="flex justify-between border-t border-[rgb(var(--line))] pt-1.5"><span className="text-ter">Account</span><span className="text-sec">{user?.email}</span></div>
              <div className="flex justify-between border-t border-[rgb(var(--line))] pt-1.5"><span className="text-ter">Member since</span><span className="text-sec">{user ? fullDate(user.createdAt) : "—"}</span></div>
              <div className="flex justify-between border-t border-[rgb(var(--line))] pt-1.5"><span className="text-ter">Status</span><span className="text-sec">Active (simulated)</span></div>
            </div>
            {planId !== "free" && (
              <Button size="sm" variant="ghost" className="mt-3" onClick={() => { upgrade("free"); pushToast("Subscription cancelled — you're on Free", "ok"); }}>
                Cancel subscription
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
            <div className="mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-[13px] font-semibold text-pri">What counts as usage</h2>
            </div>
            <ul className="space-y-2 text-[12px] leading-relaxed text-sec">
              <li><b className="text-pri">Chat message</b> — one user prompt and its response. Streaming and regeneration count once per send.</li>
              <li><b className="text-pri">Browse run</b> — one Agent task that researches the live web. Follow-up questions and downloads are free.</li>
              <li><b className="text-pri">Limits</b> reset on the first day of each month, keyed per account on this device.</li>
              <li><b className="text-pri">Admin</b> accounts can review usage across accounts in the Admin dashboard.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
