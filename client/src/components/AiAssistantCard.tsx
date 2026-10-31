import { Link } from "react-router-dom";
import { ArrowUpRight, Bot, Check, Highlighter, MessageSquareText, Sparkles, Tag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { ResearchItem } from "../types";

// Dark card for the Library sidebar; the numbers come from the clips on screen.
export default function AiAssistantCard({ items }: { items: ResearchItem[] }) {
  const { aiEnabled } = useAuth();
  const total = items.length;
  const highlights = items.reduce((n, i) => n + (i.highlights?.length ?? 0), 0);

  // ---- AI off: an overview of the person's own material ----
  if (!aiEnabled) {
    const tagged = items.filter((i) => (i.tags?.length ?? 0) > 0).length;
    const pct = total ? Math.round((tagged / total) * 100) : 0;
    const comments = items.reduce((n, i) => n + (i.comments?.length ?? 0), 0);
    const allTagged = total > 0 && tagged === total;

    return (
      <div className="rounded-2xl bg-brand p-5 text-white shadow-lg shadow-blue-950/10">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
            <Highlighter className="size-5" />
          </div>
          {total > tagged && (
            <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[10px] font-semibold text-cyan-200">
              {total - tagged} without tags
            </span>
          )}
        </div>

        <h2 className="mt-5 font-semibold">Research overview</h2>
        <p className="mt-2 text-xs leading-relaxed text-blue-100/75">
          Tick your highlights and compile them into a brief with your notes and an APA reference list.
        </p>

        <div className="my-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
              <Check className="size-3.5" />
            </div>
            <div className="flex flex-1 justify-between text-xs font-medium">
              <span>Saved clips</span>
              <span className="text-emerald-300">{total}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex size-7 items-center justify-center rounded-lg ${
                allTagged ? "bg-emerald-400/15 text-emerald-300" : "bg-cyan-400/15 text-cyan-300"
              }`}
            >
              {allTagged ? <Check className="size-3.5" /> : <Tag className="size-3.5" />}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs font-medium">
                <span>Tagged clips</span>
                <span className={allTagged ? "text-emerald-300" : "text-cyan-300"}>{pct}%</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${allTagged ? "bg-emerald-400" : "bg-cyan-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/10">
              <Highlighter className="size-3.5" />
            </div>
            <div className="flex flex-1 justify-between text-xs font-medium">
              <span>Highlights</span>
              <span className="text-blue-100/80">{highlights}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/10">
              <MessageSquareText className="size-3.5" />
            </div>
            <div className="flex flex-1 justify-between text-xs font-medium">
              <span>Comments</span>
              <span className="text-blue-100/80">{comments}</span>
            </div>
          </div>
        </div>

        <Link
          to="/highlights"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-semibold text-brand hover:bg-blue-50"
        >
          Build a brief <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  // ---- AI on: unchanged ----
  const summarized = items.filter((i) => i.aiOutput?.summary).length;
  const waiting = total - summarized;
  const pct = total ? Math.round((summarized / total) * 100) : 0;
  const allDone = total > 0 && waiting === 0;

  return (
    <div className="rounded-2xl bg-brand p-5 text-white shadow-lg shadow-blue-950/10">
      <div className="flex items-start justify-between">
        <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
          <Sparkles className="size-5" />
        </div>
        {waiting > 0 && (
          <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[10px] font-semibold text-cyan-200">
            {waiting} without summary
          </span>
        )}
      </div>

      <h2 className="mt-5 font-semibold">AI research assistant</h2>
      <p className="mt-2 text-xs leading-relaxed text-blue-100/75">
        Turn your latest sources into concise arguments, citations, and a polished brief.
      </p>

      <div className="my-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
            <Check className="size-3.5" />
          </div>
          <div className="flex flex-1 justify-between text-xs font-medium">
            <span>Saved clips</span>
            <span className="text-emerald-300">{total}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex size-7 items-center justify-center rounded-lg ${
              allDone ? "bg-emerald-400/15 text-emerald-300" : "bg-cyan-400/15 text-cyan-300"
            }`}
          >
            {allDone ? <Check className="size-3.5" /> : <Bot className="size-3.5" />}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs font-medium">
              <span>AI summaries</span>
              <span className={allDone ? "text-emerald-300" : "text-cyan-300"}>{pct}%</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${allDone ? "bg-emerald-400" : "bg-cyan-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-white/10">
            <Highlighter className="size-3.5" />
          </div>
          <div className="flex flex-1 justify-between text-xs font-medium">
            <span>Highlights</span>
            <span className="text-blue-100/80">{highlights}</span>
          </div>
        </div>
      </div>

      <Link
        to="/ai"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-semibold text-brand hover:bg-blue-50"
      >
        Open AI workspace <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  );
}