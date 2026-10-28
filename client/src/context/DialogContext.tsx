import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Modal from "../components/Modal";

type Base = {
  title: string;
  message?: ReactNode; // line breaks in a string are kept
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // red confirm button, and Cancel is focused first
};
type PromptOptions = Base & { label?: string; defaultValue?: string; placeholder?: string; maxLength?: number };

type Value = {
  confirm: (o: Base) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>; // null = cancelled
  alert: (o: Omit<Base, "danger" | "cancelLabel">) => Promise<void>;
};

type Item =
  | { id: number; kind: "confirm"; opts: Base; resolve: (v: boolean) => void }
  | { id: number; kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void }
  | { id: number; kind: "alert"; opts: Base; resolve: () => void };

const Ctx = createContext<Value | null>(null);

const btnBase = "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300";
const secondary = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const primary = `${btnBase} bg-brand text-white hover:bg-[#173b77]`;
const danger = `${btnBase} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300`;

// Owlet's replacement for window.alert / confirm / prompt. Dialogs queue up, one at a time.
export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Item[]>([]);
  const nextId = useRef(1);

  const push = useCallback(<T,>(kind: Item["kind"], opts: Base | PromptOptions) => {
    return new Promise<T>((resolve) => {
      const item = { id: nextId.current++, kind, opts, resolve } as unknown as Item;
      setQueue((q) => [...q, item]);
    });
  }, []);

  const value = useMemo<Value>(
    () => ({
      confirm: (o) => push<boolean>("confirm", o),
      prompt: (o) => push<string | null>("prompt", o),
      alert: (o) => push<void>("alert", o),
    }),
    [push]
  );

  const current = queue[0];
  const finish = (result: boolean | string | null | void) => {
    if (!current) return;
    (current.resolve as (v: unknown) => void)(result);
    setQueue((q) => q.slice(1));
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {current && <DialogView key={current.id} item={current} finish={finish} />}
    </Ctx.Provider>
  );
}

function DialogView({ item, finish }: { item: Item; finish: (r: boolean | string | null | void) => void }) {
  const { opts } = item;
  const [text, setText] = useState(item.kind === "prompt" ? item.opts.defaultValue ?? "" : "");

  const cancel = () => finish(item.kind === "confirm" ? false : item.kind === "prompt" ? null : undefined);
  const confirmLabel = opts.confirmLabel ?? (item.kind === "alert" ? "OK" : "Confirm");

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (item.kind === "prompt") {
      if (!text.trim()) return;
      finish(text);
    } else if (item.kind === "confirm") {
      finish(true);
    } else {
      finish(undefined);
    }
  }

  const footer = (
    <>
      {item.kind !== "alert" && (
        <button type="button" className={secondary} onClick={cancel} autoFocus={item.kind === "confirm" && !!opts.danger}>
          {opts.cancelLabel ?? "Cancel"}
        </button>
      )}
      <button
        type="button"
        className={opts.danger ? danger : primary}
        onClick={() => submit()}
        disabled={item.kind === "prompt" && !text.trim()}
        autoFocus={item.kind === "alert" || (item.kind === "confirm" && !opts.danger)}
      >
        {confirmLabel}
      </button>
    </>
  );

  return (
    <Modal open onClose={cancel} title={opts.title} footer={footer} hideClose={item.kind === "alert"}>
      {opts.message && <div className="whitespace-pre-line">{opts.message}</div>}
      {item.kind === "prompt" && (
        <form onSubmit={submit} className={opts.message ? "mt-4" : ""}>
          {item.opts.label && <label className="mb-1.5 block text-xs font-semibold text-slate-700">{item.opts.label}</label>}
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={item.opts.maxLength}
            placeholder={item.opts.placeholder}
            onFocus={(e) => e.currentTarget.select()}
            className="field"
          />
        </form>
      )}
    </Modal>
  );
}

export function useDialog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDialog must be used inside DialogProvider");
  return ctx;
}