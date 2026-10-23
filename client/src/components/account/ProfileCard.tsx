import { useState, type FormEvent } from "react";
import { api } from "../../services/api";
import { useAction } from "../../hooks/useAction";
import { OCCUPATIONS } from "../../utils/occupations";
import type { Account } from "../../types/account";
import SectionCard, { Note, Spinner } from "./SectionCard";

export default function ProfileCard({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [age, setAge] = useState(account.age ? String(account.age) : "");
  const [occupation, setOccupation] = useState(account.occupation ?? "");
  const [attempted, setAttempted] = useState(false);
  const action = useAction();

  const n = Number(age);
  const ageError = !age.trim()
    ? "Enter your age."
    : !Number.isInteger(n)
      ? "Use a whole number."
      : n < 13
        ? "You must be at least 13 to use Owlet."
        : n > 120
          ? "Enter a valid age."
          : "";
  const roleError = occupation ? "" : "Choose what best describes you.";

  async function save(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (ageError || roleError) return;
    const saved = await action.run(async () => {
      await api("/account/profile", { method: "PATCH", body: { age: n, occupation } });
      return "Profile saved.";
    });
    if (saved) onSaved();
  }

  return (
    <SectionCard title="Profile" description="Only you can see your age and role. Other Owlet users can't.">
      <form onSubmit={save} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <label htmlFor="occupation" className="eyebrow mb-1.5 block">I am a…</label>
            <select id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="field">
              <option value="" disabled>Choose…</option>
              {OCCUPATIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {attempted && roleError ? <p className="mt-1.5 text-xs font-medium text-red-600">{roleError}</p> : null}
          </div>
          <div>
            <label htmlFor="age" className="eyebrow mb-1.5 block">Age</label>
            <input id="age" type="number" inputMode="numeric" min={13} max={120} value={age} onChange={(e) => setAge(e.target.value)} className="field" />
            {attempted && ageError ? <p className="mt-1.5 text-xs font-medium text-red-600">{ageError}</p> : null}
          </div>
        </div>
        {action.error ? <Note kind="error">{action.error}</Note> : null}
        {action.done ? <Note kind="success">{action.done}</Note> : null}
        <button disabled={action.busy} className="btn-primary">
          {action.busy ? <><Spinner /> Saving…</> : "Save profile"}
        </button>
      </form>
    </SectionCard>
  );
}