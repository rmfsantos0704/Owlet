import { Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AiUsageIndicator() {
  const { aiUsage } = useAuth();
  if (!aiUsage) return null;

  const percentage = aiUsage.limit > 0 ? Math.min(100, (aiUsage.used / aiUsage.limit) * 100) : 0;
  const exhausted = aiUsage.remaining === 0;

  return (
    <section
      aria-label="Daily AI allowance"
      className="mx-1 mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Sparkles className="size-4 text-brand" />
          AI today
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-700">
          {aiUsage.used} / {aiUsage.limit}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Daily AI usage"
        aria-valuemin={0}
        aria-valuemax={aiUsage.limit}
        aria-valuenow={Math.min(aiUsage.used, aiUsage.limit)}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {exhausted
          ? "Daily allowance used. AI is off for your account until midnight UTC."
          : `${aiUsage.remaining} ${aiUsage.remaining === 1 ? "use" : "uses"} left today. AI pauses for your account when used up.`}
      </p>
    </section>
  );
}
