import { passwordStrength } from "../../utils/password";

const COLORS = ["bg-slate-200", "bg-red-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500"];

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = passwordStrength(password);
  return (
    <div className="-mt-1" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= score ? COLORS[score] : "bg-slate-200"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Password strength: <span className="font-semibold text-slate-700">{label}</span>
      </p>
    </div>
  );
}