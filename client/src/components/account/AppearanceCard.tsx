import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import SectionCard from "./SectionCard";

export default function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <SectionCard title="Appearance" description="Choose the look that's comfortable for you. This setting is saved on this device.">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            {isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </span>
          <div>
            <p className="text-sm font-medium text-slate-800">{isDark ? "Dark mode" : "Light mode"}</p>
            <p className="text-xs text-slate-500">Switch between light and dark appearance.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label="Dark mode"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
            isDark ? "bg-brand" : "bg-slate-300"
          }`}
        >
          <span className={`appearance-switch-knob inline-block size-5 rounded-full bg-white shadow transition-transform ${isDark ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    </SectionCard>
  );
}
