import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { canPromptInstall, isInstalledApp, isIos, onInstallChange, promptInstall } from "../../utils/pwa";

// Helps people put Owlet on their phone. On Android Chrome an installed Owlet appears in the Share menu,
// so any page can be sent straight to it.
export default function InstallCard() {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  const [busy, setBusy] = useState(false);
  const installed = isInstalledApp();
  const ios = isIos();

  useEffect(() => onInstallChange(() => setCanPrompt(canPromptInstall())), []);

  async function install() {
    if (busy) return;
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          <Smartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">Owlet on your phone</h2>
          {installed ? (
            <p className="mt-1 text-sm text-slate-500">
              You're using Owlet as an installed app. On Android, you can now send any page to it from the Share menu of your browser.
            </p>
          ) : ios ? (
            <p className="mt-1 text-sm text-slate-500">
              In Safari, tap Share, then Add to Home Screen, to open Owlet like an app. iPhones don't add apps to the Share menu, so to send a page to Owlet,
              paste its link into Save a link on your library page, or set up the Shortcut described in Help.
            </p>
          ) : canPrompt ? (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Install Owlet to open it like an app. Afterwards, Owlet appears in your phone's Share menu, so you can send any page straight to it.
              </p>
              <button type="button" onClick={install} disabled={busy} className="btn-primary mt-3">
                Install Owlet
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              On Android, open your browser's menu and choose Install app (or Add to Home screen). Afterwards, Owlet appears in your phone's Share menu, so you can send
              any page straight to it. You can also paste a link into Save a link on your library page at any time.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}