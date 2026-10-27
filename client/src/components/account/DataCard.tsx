import { api } from "../../services/api";
import { useAction } from "../../hooks/useAction";
import SectionCard, { Note } from "./SectionCard";

export default function DataCard() {
  const action = useAction();

  async function download() {
    await action.run(async () => {
      const data = await api<unknown>("/account/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `owlet-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return "Your data was downloaded.";
    });
  }

  return (
    <SectionCard
      title="Your data"
      description="Download a copy of your profile, the collections you own with all their clips, highlights and comments, and what you've contributed to other people's collections."
    >
      {action.error ? <div className="mb-3"><Note kind="error">{action.error}</Note></div> : null}
      {action.done ? <div className="mb-3"><Note kind="success">{action.done}</Note></div> : null}
      <button onClick={download} disabled={action.busy} className="btn-secondary">
        {action.busy ? <><span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> Preparing…</> : "Download my data"}
      </button>
    </SectionCard>
  );
}