import { Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AiUsageIndicator({ compact = false }: { compact?: boolean }) {
  const { aiUsage } = useAuth();
  if (!aiUsage) return null;

  const percentage = aiUsage.limit > 0 ? Math.min(100, (aiUsage.used / aiUsage.limit) * 100) : 0;
  const exhausted = aiUsage.remaining === 0;
  const message = exhausted
    ? "You've used all your AI uses for today. Your allowance resets at midnight UTC."
    : `${aiUsage.remaining} ${aiUsage.remaining === 1 ? "use" : "uses"} left today.`;

  return (
    <div
      className={`ai-usage-popover ${exhausted ? "ai-usage-exhausted" : ""} ${
        compact
          ? "relative shrink-0"
          : "mx-1 mt-4"
      }`}
    >
      <section
        aria-label="Daily AI allowance"
        tabIndex={compact ? 0 : undefined}
        aria-describedby={compact ? "ai-usage-message" : undefined}
        className={
          compact
            ? "flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
            : "rounded-xl border border-slate-200 bg-slate-50 p-3"
        }
      >
        <div className={`flex items-center ${compact ? "gap-1.5" : "justify-between gap-2"}`}>
          <div className={`flex items-center text-xs font-semibold text-slate-700 ${compact ? "gap-1" : "gap-2"}`}>
            <Sparkles className={`${compact ? "size-3.5" : "size-4"} text-brand`} />
            {compact ? <span className="sr-only">AI today</span> : "AI today"}
          </div>
          <span className={`font-semibold tabular-nums text-slate-700 ${compact ? "text-[10px]" : "text-xs"}`}>
            {aiUsage.used} / {aiUsage.limit}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Daily AI usage"
          aria-valuemin={0}
          aria-valuemax={aiUsage.limit}
          aria-valuenow={Math.min(aiUsage.used, aiUsage.limit)}
          className={`overflow-hidden rounded-full bg-slate-200 ${compact ? "mt-1 h-1 w-10" : "mt-2 h-1.5"}`}
        >
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percentage}%` }} />
        </div>
        {!compact && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{message}</p>}
      </section>
      {compact && <p id="ai-usage-message" role={exhausted ? "status" : undefined} className="ai-usage-toast">{message}</p>}
    </div>
  );
}
